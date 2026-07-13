import { Bet } from "./seed";
import { detectCategory } from "./parseOdds";
import { defaultUnitsToWinOne } from "./units";

// A header line like "Scottish Open Round 4" - tournament and round
// together on one line.
const HEADER_RE = /^(.*?)\s+Round\s+(\d+)\s*:?$/i;
const TIME_RE = /^(\d{1,2}:\d{2}\s*[AP]M)\s+/i;

export type ParseResult = { bets: Bet[]; warnings: string[] };

// Converts a raw sportsbook line (side + line value + category) into the
// plain-English phrase the rest of the app already understands ("11+
// pars", "-2 or better", etc). Returns null only for SCORE bets when no
// round par is on file yet - that's the one category that actually needs
// external info (the course's par) to convert raw strokes to to-par terms;
// every count-based category (greens/birdies/bogeys/pars) is pure
// arithmetic and never needs it.
export function deriveBetPhrase(
  side: "Over" | "Under",
  lineValue: string,
  category: "SCORE" | "GIR" | "BIRDIES" | "BOGEYS" | "PARS",
  roundPar: number | undefined
): string | null {
  const line = parseFloat(lineValue);
  if (isNaN(line)) return null;

  if (category === "SCORE") {
    if (roundPar === undefined) return null;
    const targetStrokes = side === "Under" ? Math.floor(line) : Math.ceil(line);
    const targetToPar = targetStrokes - roundPar;
    const display = targetToPar === 0 ? "E" : targetToPar > 0 ? `+${targetToPar}` : `${targetToPar}`;
    return side === "Under" ? `${display} or better` : `${display} or worse`;
  }

  const noun = category === "GIR" ? "greens" : category === "BIRDIES" ? "birdies" : category === "BOGEYS" ? "bogeys" : "pars";
  if (side === "Over") {
    const threshold = Math.floor(line) + 1;
    return `${threshold}+ ${noun}`;
  }
  const threshold = Math.floor(line);
  return `${threshold} ${noun} or less`;
}

// Parses the combined format: a "Tournament Round N" header, then one line
// per bet: "TIME Player **Over/Under** Line [Category] Price (DK) for X
// units" - both the plain-English bet description and the odds come from
// this single line, no separate odds paste needed.
export function parseCombinedText(
  text: string,
  forDate: string | undefined,
  roundParLookup: (tournament: string) => number | undefined
): ParseResult {
  const rawLines = text.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);

  // Odds occasionally wrap onto a second line (multiple sportsbooks listed) -
  // fold any line that isn't a header and doesn't start with a time back
  // into the previous line.
  const lines: string[] = [];
  for (const line of rawLines) {
    if (HEADER_RE.test(line) || TIME_RE.test(line) || lines.length === 0) {
      lines.push(line);
    } else {
      lines[lines.length - 1] += " " + line;
    }
  }

  let loadedDate = forDate;
  if (!loadedDate) {
    const today = new Date();
    loadedDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  }

  let currentTournament = "";
  let currentRound = "";
  const bets: Bet[] = [];
  const warnings: string[] = [];
  let counter = 0;

  for (const line of lines) {
    const headerMatch = line.match(HEADER_RE);
    if (headerMatch) {
      currentTournament = headerMatch[1]
        .replace(/[\u{1F1E6}-\u{1F1FF}\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{E0000}-\u{E007F}\uFE0F]/gu, "")
        .trim();
      currentRound = `Round ${headerMatch[2]}`;
      continue;
    }

    const timeMatch = line.match(TIME_RE);
    if (!timeMatch) {
      warnings.push(`Couldn't find a time at the start of: "${line}"`);
      continue;
    }
    const time = timeMatch[1];
    const rest = line.slice(timeMatch[0].length);

    const sideAt = rest.search(/\*\*(\w+)\*\*/);
    if (sideAt === -1) {
      warnings.push(`Couldn't find Over/Under in: "${line}"`);
      continue;
    }
    const player = rest.slice(0, sideAt).trim();
    const sideMatch = rest.slice(sideAt).match(/^\*\*(\w+)\*\*/)!;
    const side: "Over" | "Under" = /^over$/i.test(sideMatch[1]) ? "Over" : "Under";

    const afterSide = rest.slice(sideAt + sideMatch[0].length);
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
    const units = unitsMatch ? unitsMatch[1] : String(defaultUnitsToWinOne(oddsDK));

    if (!currentTournament || !currentRound) {
      warnings.push(`Bet found before any tournament header: "${line}"`);
      continue;
    }

    const phrase = deriveBetPhrase(side, lineValue, category, roundParLookup(currentTournament));
    if (!phrase) {
      warnings.push(`No round par on file for "${currentTournament}" - add one in the Tournaments tab to convert score bets. Skipped: "${line}"`);
      continue;
    }

    bets.push({
      id: "b" + counter++ + "_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
      t: currentTournament,
      r: currentRound,
      time,
      player,
      bet: phrase,
      stat: null,
      thru: null,
      status: "pending",
      autoEnabled: true,
      auto: null,
      oddsLine: `${side} ${lineValue}`,
      oddsPrice: oddsDK,
      oddsUnits: units,
      loadedDate,
    });
  }

  return { bets, warnings };
}
