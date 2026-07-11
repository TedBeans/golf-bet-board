import { Bet } from "./seed";
import { parseBetType } from "./betLogic";

export type OddsEntry = {
  tournament: string;
  round: string;
  player: string;
  side: "Over" | "Under";
  lineValue: string;
  category: "SCORE" | "GIR" | "BIRDIES" | "BOGEYS";
  oddsDK: string | null;
  units: string | null;
  raw: string;
};

// A header line like "ISCO Championship Round 3" - tournament and round
// together on one line, unlike the nightly bet-list format.
const HEADER_RE = /^(.*?)\s+Round\s+(\d+)\s*:?$/i;
// A line starting a new entry: "Player Name **Under** ..."
const PLAYER_START_RE = /^([A-Za-z.'\u2019\-\u00C0-\u024F ]+?)\s*\*\*/;

function detectCategory(text: string): "SCORE" | "GIR" | "BIRDIES" | "BOGEYS" {
  if (/bogeys/i.test(text)) return "BOGEYS";
  if (/birdies/i.test(text)) return "BIRDIES";
  if (/greens/i.test(text)) return "GIR";
  return "SCORE";
}

export type OddsParseResult = { entries: OddsEntry[]; warnings: string[] };

export function parseOddsText(text: string): OddsParseResult {
  const rawLines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  // Odds sometimes wrap onto a second line (multiple sportsbooks listed).
  // Any line that isn't a header and doesn't start a new player entry gets
  // folded into the previous line.
  const lines: string[] = [];
  for (const line of rawLines) {
    if (HEADER_RE.test(line) || PLAYER_START_RE.test(line) || lines.length === 0) {
      lines.push(line);
    } else {
      lines[lines.length - 1] += " " + line;
    }
  }

  let currentTournament = "";
  let currentRound = "";
  const entries: OddsEntry[] = [];
  const warnings: string[] = [];

  for (const line of lines) {
    const headerMatch = line.match(HEADER_RE);
    if (headerMatch) {
      currentTournament = headerMatch[1].trim();
      currentRound = `Round ${headerMatch[2]}`;
      continue;
    }

    const playerMatch = line.match(PLAYER_START_RE);
    if (!playerMatch) {
      warnings.push(`Couldn't parse line: "${line}"`);
      continue;
    }
    const player = playerMatch[1].trim();
    const rest = line.slice(playerMatch[0].length);

    const sideMatch = rest.match(/^\s*(\w+)\*\*/i);
    if (!sideMatch) {
      warnings.push(`Couldn't find Over/Under in: "${line}"`);
      continue;
    }
    const side: "Over" | "Under" = /^over$/i.test(sideMatch[1]) ? "Over" : "Under";

    const afterSide = rest.slice(sideMatch[0].length);
    const lineValMatch = afterSide.match(/([\d.]+)/);
    if (!lineValMatch) {
      warnings.push(`Couldn't find a line value in: "${line}"`);
      continue;
    }
    const lineValue = lineValMatch[1];
    const category = detectCategory(afterSide);

    const dkMatch = line.match(/([+-]\d+)\s*\(\s*DK\s*\)/i);
    const oddsDK = dkMatch ? dkMatch[1] : null;
    if (!oddsDK) warnings.push(`No DK odds found for ${player} - "${line}"`);

    const unitsMatch = line.match(/for\s+([\d.]+)\s*units?/i);
    const units = unitsMatch ? unitsMatch[1] : null;

    if (!currentTournament) {
      warnings.push(`Entry found before any tournament header: "${line}"`);
      continue;
    }

    entries.push({
      tournament: currentTournament,
      round: currentRound || "Round 1",
      player,
      side,
      lineValue,
      category,
      oddsDK,
      units,
      raw: line,
    });
  }

  return { entries, warnings };
}

function normalizeName(s: string): string {
  return s.toLowerCase().replace(/[.\u2019']/g, "").trim();
}

export type OddsMatchResult = { bets: Bet[]; matched: number; warnings: string[] };

// Matches parsed odds entries onto existing bets by player name + round +
// bet category (score/GIR/birdies/bogeys) - tournament name isn't required
// to match exactly since a player generally only has bets in one tournament
// at a time.
export function attachOddsToBets(entries: OddsEntry[], bets: Bet[]): OddsMatchResult {
  const updated = bets.map((b) => ({ ...b }));
  const warnings: string[] = [];
  let matched = 0;

  for (const entry of entries) {
    const candidates = updated.filter((b) => {
      if (b.r !== entry.round) return false;
      if (normalizeName(b.player) !== normalizeName(entry.player)) return false;
      return parseBetType(b.bet).label === entry.category;
    });

    if (candidates.length === 0) {
      warnings.push(`No matching bet found for ${entry.player} (${entry.category}, ${entry.round}) - "${entry.raw}"`);
      continue;
    }
    if (candidates.length > 1) {
      warnings.push(`Multiple bets matched ${entry.player} (${entry.category}, ${entry.round}) - applied to the first one`);
    }

    const target = candidates[0];
    target.oddsLine = `${entry.side} ${entry.lineValue}`;
    target.oddsPrice = entry.oddsDK;
    target.oddsUnits = entry.units;
    matched += 1;
  }

  return { bets: updated, matched, warnings };
}
