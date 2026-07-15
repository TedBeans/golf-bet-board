import { Bet } from "./seed";
import { defaultUnitsToWinOne } from "./units";

export type ParsePersonalResult = { bets: Bet[]; warnings: string[] };

// Personal plays are tournament-long propositions (outright winner, top-N
// finish, make-the-cut, head-to-head) rather than the nightly over/under
// paste - so unlike parseCombined's "Tournament Round N" header, this
// format just needs the tournament name on its own line, then one bet per
// line after it:
//
//   The Open Championship
//   Wyndham Clark Top 10 +450 (DK) for 25 units
//   Akshay Bhatia Winner +8000 (DK) for 10 units
//   Someone Else Make Cut -200 (DK) for 5 units
//   Wyndham Clark vs Jon Rahm Round 1 +110 (DK) for 1 unit
//
// A line counts as a header (not a bet) whenever it has no odds marker in
// it at all - every real bet line has one, so this is a reliable enough
// split without needing a fixed header shape the way the nightly paste has.
export const PERSONAL_ROUND_LABEL = "TedBeans Plays";

// H2H is always "PlayerA vs PlayerB <scope>" - the bet is on PlayerA (the
// first name listed) to have the better score for that scope, per TedBeans'
// own call. Checked before the other patterns since none of them share its
// "vs ... Round N / Tournament" shape.
const H2H_ROUND_RE = /^(.*?)\s+vs\.?\s+(.*?)\s+Round\s+(\d+)$/i;
const H2H_TOURNAMENT_RE = /^(.*?)\s+vs\.?\s+(.*?)\s+Tournament$/i;

// Tie matchups - a genuinely different bet than H2H: the wager wins only if
// the two players finish the scope at the exact same score, not if either
// one beats the other. "Matchup" at the end is optional since it's just
// flavor text, not load-bearing.
const TIE_ROUND_RE = /^(.*?)\s+and\s+(.*?)\s+to\s+tie\s+Round\s+(\d+)(?:\s+Matchup)?$/i;
const TIE_TOURNAMENT_RE = /^(.*?)\s+and\s+(.*?)\s+to\s+tie\s+Tournament(?:\s+Matchup)?$/i;

const TOPN_RE = /^(.*?)\s+Top\s+(\d+)$/i;
// Accepts plain "Winner" or "outright winner" - either way, stored as the
// same canonical "Winner" phrase, so nothing downstream needs to know which
// input variant was actually typed.
const WINNER_RE = /^(.*?)\s+(?:outright\s+)?winner$/i;
// Accepts "Make Cut", "make the cut", "to make the cut", "to make cut" -
// all stored as the same canonical "Make Cut" phrase.
const MAKECUT_RE = /^(.*?)\s+(?:to\s+)?make\s+(?:the\s+)?cut$/i;

const ODDS_RE = /([+-]\d+)\s*\(\s*([A-Za-z]{2,5})\s*\)/;
const UNITS_RE = /for\s+([\d.]+)\s*units?/i;

export function parsePersonalText(text: string, forDate: string | undefined): ParsePersonalResult {
  const rawLines = text.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);

  let loadedDate = forDate;
  if (!loadedDate) {
    const today = new Date();
    loadedDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  }

  let currentTournament = "";
  const bets: Bet[] = [];
  const warnings: string[] = [];
  let counter = 0;

  for (const line of rawLines) {
    if (!ODDS_RE.test(line)) {
      currentTournament = line
        .replace(/[\u{1F1E6}-\u{1F1FF}\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{E0000}-\u{E007F}\uFE0F]/gu, "")
        .trim();
      continue;
    }

    if (!currentTournament) {
      warnings.push(`Bet found before any tournament header: "${line}"`);
      continue;
    }

    const oddsMatch = line.match(ODDS_RE)!;
    const descriptor = line.slice(0, oddsMatch.index).trim();
    const price = oddsMatch[1];
    const sportsbook = oddsMatch[2].toUpperCase();
    const afterOdds = line.slice((oddsMatch.index ?? 0) + oddsMatch[0].length);
    const unitsMatch = afterOdds.match(UNITS_RE);
    const units = unitsMatch ? unitsMatch[1] : String(defaultUnitsToWinOne(price));

    let player: string | null = null;
    let phrase: string | null = null;
    let m: RegExpMatchArray | null;

    if ((m = descriptor.match(H2H_ROUND_RE))) {
      player = m[1].trim();
      phrase = `H2H vs ${m[2].trim()} (Round ${m[3]})`;
    } else if ((m = descriptor.match(H2H_TOURNAMENT_RE))) {
      player = m[1].trim();
      phrase = `H2H vs ${m[2].trim()} (Tournament)`;
    } else if ((m = descriptor.match(TIE_ROUND_RE))) {
      player = m[1].trim();
      phrase = `Tie vs ${m[2].trim()} (Round ${m[3]})`;
    } else if ((m = descriptor.match(TIE_TOURNAMENT_RE))) {
      player = m[1].trim();
      phrase = `Tie vs ${m[2].trim()} (Tournament)`;
    } else if ((m = descriptor.match(TOPN_RE))) {
      player = m[1].trim();
      phrase = `Top ${m[2]}`;
    } else if ((m = descriptor.match(WINNER_RE))) {
      player = m[1].trim();
      phrase = "Winner";
    } else if ((m = descriptor.match(MAKECUT_RE))) {
      player = m[1].trim();
      phrase = "Make Cut";
    }

    if (!player || !phrase) {
      warnings.push(`Couldn't recognize a bet type (Top N / Winner / outright Winner / Make Cut / to make the cut / "vs ... Round N" / "vs ... Tournament" / "and ... to tie Round N" / "and ... to tie Tournament") in: "${line}"`);
      continue;
    }

    bets.push({
      id: "bp" + counter++ + "_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
      t: currentTournament,
      r: PERSONAL_ROUND_LABEL,
      time: "",
      player,
      bet: phrase,
      stat: null,
      thru: null,
      // Tournament-long, not tied to one tee time - live immediately, no
      // pending phase to promote out of (see the sync route's tee-time-gate
      // bypass for bets with personal: true).
      status: "live",
      autoEnabled: true,
      auto: null,
      oddsLine: null,
      oddsPrice: price,
      sportsbook,
      oddsUnits: units,
      loadedDate,
      personal: true,
    });
  }

  return { bets, warnings };
}
