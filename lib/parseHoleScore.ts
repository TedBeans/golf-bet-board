// Single-hole outcome props ("Birdie or Better" on a specific hole) don't
// fit the rest of this app's paste format at all - every other category
// is "Player **Over/Under** Line [Category]", a numeric line against a
// running stat. A hole-score bet has no numeric line and no Over/Under
// side; it's a flat "this hole will land in this bucket" market. So this
// gets its own line shape entirely, detected separately from the
// Over/Under path before either parser tries to match against it.
//
// Paste line shape: "[TIME] Player Hole N Birdie or Better Price (BOOK)
// [for X units]" - same TIME/odds/book/units conventions as every other
// line in this app, just swapping the Over/Under+line+category chunk for
// "Hole N <outcome>".
const HOLE_SCORE_LINE_RE =
  /^(.*?)\s+hole\s+(\d{1,2})\s+(eagle|birdie|par|bogey|double bogey)(?:\s+or\s+(better|worse))?\s+([+-]\d+)\s*\(\s*([A-Za-z]{2,5})\s*\)(?:\s+for\s+([\d.]+)\s*units?)?\s*$/i;

export function isHoleScoreLine(line: string): boolean {
  return /\bhole\s+\d{1,2}\s+(eagle|birdie|par|bogey|double\s+bogey)\b/i.test(line);
}

export type HoleScoreLineMatch = {
  player: string;
  holeNumber: string;
  outcomeName: string;
  direction: string | null; // "better" | "worse" | null (null = exact)
  oddsPrice: string;
  sportsbook: string;
  units: string | null;
  bet: string; // canonical phrase for parseBetType, e.g. "Hole 1 Birdie or Better"
};

export function parseHoleScoreLine(line: string): HoleScoreLineMatch | null {
  const m = line.match(HOLE_SCORE_LINE_RE);
  if (!m) return null;
  const [, player, holeNumber, outcomeName, direction, oddsPrice, sportsbook, units] = m;
  const proper = outcomeName.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  const bet = direction ? `Hole ${holeNumber} ${proper} or ${direction.toLowerCase()}` : `Hole ${holeNumber} ${proper}`;
  return {
    player: player.trim(),
    holeNumber,
    outcomeName: proper,
    direction: direction ? direction.toLowerCase() : null,
    oddsPrice,
    sportsbook: sportsbook.toUpperCase(),
    units: units || null,
    bet,
  };
}
