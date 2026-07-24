import { Bet } from "./seed";
import { defaultUnitsToWinOne } from "./units";
import { deriveBetPhrase } from "./parseCombined";
import { Mapping } from "./mapping";

export type ParsePersonalResult = { bets: Bet[]; warnings: string[] };

// Personal plays are tournament-long propositions (outright winner, top-N
// finish, make-the-cut, head-to-head) as well as round-scoped stat bets
// (score, greens, birdies, bogeys, pars, fairways) - the same bet types
// available in the nightly paste, just entered in personal-play format.
// Format: tournament name on its own line, then one bet per line:
//
//   The Open Championship
//   Wyndham Clark Top 10 +450 (DK) for 25 units
//   Akshay Bhatia Winner +8000 (DK) for 10 units
//   Someone Else Make Cut -200 (DK) for 5 units
//   Wyndham Clark vs Jon Rahm Round 1 +110 (DK) for 1 unit
//   Tommy Fleetwood Round 1 Over 11.5 Pars -135 (DK) for 1.35 units
//   Tommy Fleetwood Round 2 Under 8.5 Fairways +112 (DK) for 1 unit
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

// Round-scoped stat bets: "Player [Round N] Over/Under X.X [Category]"
// e.g. "Tommy Fleetwood Round 1 Over 11.5 Pars"
//      "Maverick McNealy Over 8.5 Fairways" (Round defaults to 1)
//      "Scottie Scheffler Over 68.5" (score bet, no category, defaults Round 1)
// Round N is optional - defaults to Round 1 if not provided.
// The **bold** markers from the nightly paste are NOT required here.
const ROUND_STAT_RE = /^(.*?)\s+(?:Round\s+(\d+)\s+)?(over|under)\s+([\d.]+)(?:\s+(greens?|fairways?|birdies?|bogeys?|pars?))?$/i;

const ODDS_RE = /([+-]\d+)\s*\(\s*([A-Za-z]{2,5})\s*\)/;
const UNITS_RE = /for\s+([\d.]+)\s*units?/i;

export function parsePersonalText(text: string, forDate: string | undefined, mapping?: Mapping | null): ParsePersonalResult {
  const rawLines = text.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);

  let loadedDate = forDate;
  if (!loadedDate) {
    const today = new Date();
    loadedDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  }

  let currentTournament = "";
  let currentDefaultRound = 1; // set when the header line includes "Round N"
  const bets: Bet[] = [];
  const warnings: string[] = [];
  let counter = 0;

  for (const line of rawLines) {
    if (!ODDS_RE.test(line)) {
      // Header line - strip trailing "Round N" if present so "3M Open Round 1"
      // correctly sets tournament = "3M Open" and default round = 1.
      const roundHeaderMatch = line.match(/^(.*?)\s+Round\s+(\d+)\s*$/i);
      if (roundHeaderMatch) {
        currentTournament = roundHeaderMatch[1]
          .replace(/[\u{1F1E6}-\u{1F1FF}\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{E0000}-\u{E007F}\uFE0F]/gu, "")
          .trim();
        currentDefaultRound = parseInt(roundHeaderMatch[2], 10);
      } else {
        currentTournament = line
          .replace(/[\u{1F1E6}-\u{1F1FF}\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{E0000}-\u{E007F}\uFE0F]/gu, "")
          .trim();
        currentDefaultRound = 1;
      }
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
    } else if ((m = descriptor.match(ROUND_STAT_RE))) {
      player = m[1].trim();
      // Use Round N from the bet line if present, otherwise fall back to
      // the round number from the header (e.g. "3M Open Round 1"), and
      // finally default to 1 if neither specifies one.
      const roundNum = m[2] ? parseInt(m[2], 10) : currentDefaultRound;
      const side = m[3].toLowerCase(); // "over" | "under"
      const line = parseFloat(m[4]);
      const catRaw = (m[5] || "").toLowerCase();
      // Derive the noun for the phrase - same canonical phrases parseCombined
      // produces so all downstream grading/display logic is unchanged.
      let noun: string;
      if (/fairway/.test(catRaw)) noun = "fairways";
      else if (/green/.test(catRaw)) noun = "greens";
      else if (/birdie/.test(catRaw)) noun = "birdies";
      else if (/bogey/.test(catRaw)) noun = "bogeys";
      else if (/par/.test(catRaw)) noun = "pars";
      else noun = ""; // score bet - no noun
      // Convert line to a threshold: 11.5 Over → 12+, 11.5 Under → 11 or fewer
      const isOver = side === "over";
      let betPhrase: string;
      if (noun === "") {
        // Score bet - use deriveBetPhrase so it converts raw strokes to
        // to-par terms using the tournament's roundPar, exactly the same
        // way parseCombined does. Falls back to raw strokes if no par on
        // file (same "skip with a warning" behaviour as parseCombined).
        const tm = mapping?.tournaments?.[currentTournament];
        const roundPar = tm?.roundPar;
        const derived = deriveBetPhrase(
          isOver ? "Over" : "Under",
          String(line),
          "SCORE",
          roundPar,
          undefined // no segment for personal score bets (full round only)
        );
        if (derived === null) {
          warnings.push(`No round par on file for "${currentTournament}" - add one in Admin → Tournaments to convert score bets. Skipped: "${line}"`);
          continue;
        }
        betPhrase = derived;
      } else {
        const threshold = isOver ? Math.ceil(line) : Math.floor(line);
        betPhrase = isOver ? `${threshold}+ ${noun}` : `${threshold} ${noun} or less`;
      }
      phrase = betPhrase;
      // Use the actual round label so sync routes/grading find the right
      // round data, and so the scorecard popover opens the right round.
      // We return early here to override the default PERSONAL_ROUND_LABEL.
      bets.push({
        id: "bp" + counter++ + "_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
        t: currentTournament,
        r: `Round ${roundNum}`,
        time: "",
        player,
        bet: betPhrase,
        stat: null,
        thru: null,
        status: "pending",
        autoEnabled: true,
        auto: null,
        oddsLine: `${side.charAt(0).toUpperCase() + side.slice(1)} ${line}${noun ? " " + noun.charAt(0).toUpperCase() + noun.slice(1) : ""}`,
        oddsPrice: price,
        sportsbook,
        oddsUnits: units,
        loadedDate,
        personal: true,
      });
      continue;
    }

    if (!player || !phrase) {
      warnings.push(`Couldn't recognize a bet type in: "${line}"\nSupported: Top N / Winner / Make Cut / H2H ("vs ... Round N" / "vs ... Tournament") / Tie ("and ... to tie") / Stat ("Player Round N Over/Under X.X [Greens/Fairways/Birdies/Bogeys/Pars]")`);
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
      // Tournament-long, not tied to one tee time - promoted to live once
      // any regular bet for the same tournament confirms play has actually
      // started (see the sync route's personal-bet promotion check), not
      // immediately at creation. This keeps the board honest (TBD, not "IN
      // PROGRESS", before anything's actually happening) and skips fetching
      // for these entirely until there's something worth fetching.
      status: "pending",
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
