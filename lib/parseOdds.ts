import { Bet } from "./seed";
import { parseBetType } from "./betLogic";
import { defaultUnitsToWinOne } from "./units";

export type OddsEntry = {
  tournament: string;
  round: string;
  player: string;
  side: "Over" | "Under";
  lineValue: string;
  category: "SCORE" | "GIR" | "BIRDIES" | "BOGEYS" | "PARS";
  oddsDK: string | null;
  units: string | null;
  raw: string;
};

// A header line like "ISCO Championship Round 3" - tournament and round
// together on one line, unlike the nightly bet-list format.
const HEADER_RE = /^(.*?)\s+Round\s+(\d+)\s*:?$/i;
// A line starting a new entry: "Player Name **Under** ..."
const PLAYER_START_RE = /^([A-Za-z.'\u2019\-\u00C0-\u024F ]+?)\s*\*\*/;

export function detectCategory(text: string): "SCORE" | "GIR" | "BIRDIES" | "BOGEYS" | "PARS" {
  if (/bogeys/i.test(text)) return "BOGEYS";
  if (/birdies/i.test(text)) return "BIRDIES";
  if (/greens/i.test(text)) return "GIR";
  if (/pars/i.test(text)) return "PARS";
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
    // No explicit "for X units" in the paste - default to risking whatever
    // it takes to win exactly 1 unit at this price, rather than leaving it
    // blank (which silently drops the bet out of every units calculation).
    const units = unitsMatch ? unitsMatch[1] : String(defaultUnitsToWinOne(oddsDK));

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

// Standard edit distance - counts single-character insertions, deletions,
// and substitutions needed to turn one string into the other. Used to
// catch small typos ("Jaegar" vs "Jaeger") that an exact match would miss.
function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[m][n];
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
    const sameRoundAndType = updated.filter((b) => b.r === entry.round && parseBetType(b.bet).label === entry.category);

    let candidates = sameRoundAndType.filter((b) => normalizeName(b.player) === normalizeName(entry.player));

    // No exact match - try a typo-tolerant fallback before giving up. A
    // small edit distance relative to name length catches things like a
    // single swapped letter without falsely matching unrelated players.
    let fuzzyMatch = false;
    if (candidates.length === 0) {
      const target = normalizeName(entry.player);
      let best: Bet | null = null;
      let bestDist = Infinity;
      for (const b of sameRoundAndType) {
        const dist = levenshtein(normalizeName(b.player), target);
        if (dist < bestDist) {
          bestDist = dist;
          best = b;
        }
      }
      const tolerance = Math.max(1, Math.round(target.length * 0.15));
      if (best && bestDist <= tolerance) {
        candidates = [best];
        fuzzyMatch = true;
      }
    }

    if (candidates.length === 0) {
      warnings.push(`No matching bet found for ${entry.player} (${entry.category}, ${entry.round}) - "${entry.raw}"`);
      continue;
    }
    if (candidates.length > 1) {
      warnings.push(`Multiple bets matched ${entry.player} (${entry.category}, ${entry.round}) - applied to the first one`);
    }
    if (fuzzyMatch) {
      warnings.push(`Matched "${entry.player}" to "${candidates[0].player}" despite the spelling difference - double check this one.`);
    }

    const target = candidates[0];
    target.oddsLine = `${entry.side} ${entry.lineValue}`;
    target.oddsPrice = entry.oddsDK;
    target.oddsUnits = entry.units;
    matched += 1;
  }

  return { bets: updated, matched, warnings };
}
