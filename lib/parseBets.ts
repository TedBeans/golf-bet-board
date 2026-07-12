import { Bet } from "./seed";

const TIME_RE = /^(\d{1,2}:\d{2}\s*(?:AM|PM))\s+(.*)$/i;
const ROUND_RE = /^round\s+(\d+)\s*:?$/i;
// Matches the known bet-type phrases anywhere in the remainder of a line.
// Everything before the match is treated as the player name.
const BET_PHRASE_RE = /((-?\d+|E)\s+or\s+(?:better|worse)|\d+\+\s*greens|\d+\s*greens\s+or\s+less|\d+\s*birdies\s+or\s+less|\d+\s*bogeys\s+or\s+less|\d+\+\s*pars|\d+\s*pars\s+or\s+less)/i;

export type ParseResult = { bets: Bet[]; warnings: string[] };

export function parseBetsText(text: string, forDate?: string): ParseResult {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  let loadedDate = forDate;
  if (!loadedDate) {
    const today = new Date();
    loadedDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  }

  let currentTournament = "";
  let currentRound = "";
  const bets: Bet[] = [];
  const warnings: string[] = [];
  let counter = 1;

  for (const line of lines) {
    const timeMatch = line.match(TIME_RE);
    if (timeMatch) {
      const time = timeMatch[1].toUpperCase().replace(/\s+/g, " ");
      const rest = timeMatch[2];
      const betMatch = rest.match(BET_PHRASE_RE);

      if (!betMatch || betMatch.index === undefined) {
        warnings.push(`Couldn't find a recognized bet type in: "${line}"`);
        continue;
      }
      const player = rest.slice(0, betMatch.index).trim();
      const bet = betMatch[1].trim();

      if (!player) {
        warnings.push(`Couldn't find a player name in: "${line}"`);
        continue;
      }
      if (!currentTournament) {
        warnings.push(`Bet found before any tournament header: "${line}"`);
        continue;
      }
      if (!currentRound) {
        warnings.push(`Bet found before any "Round N:" header - skipped so it doesn't get mis-filed: "${line}"`);
        continue;
      }

      bets.push({
        id: "b" + counter++ + "_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
        t: currentTournament,
        r: currentRound,
        time,
        player,
        bet,
        stat: null,
        thru: null,
        status: "pending",
        autoEnabled: true,
        auto: null,
        loadedDate,
      });
      continue;
    }

    const roundMatch = line.match(ROUND_RE);
    if (roundMatch) {
      currentRound = `Round ${roundMatch[1]}`;
      continue;
    }

    // Anything else that isn't a time line or round line is a tournament
    // header - strip a trailing colon and any emoji/flag characters, so a
    // header pasted with or without a flag (e.g. "Scottish Open" vs
    // "Scottish Open \u{1F3F4}...") always normalizes to the same tournament
    // instead of silently forking into two separate sections.
    const header = line
      .replace(/:\s*$/, "")
      .replace(/[\u{1F1E6}-\u{1F1FF}\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{E0000}-\u{E007F}\uFE0F]/gu, "")
      .trim();
    if (header) currentTournament = header;
  }

  return { bets, warnings };
}
