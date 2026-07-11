export const HOLES_IN_ROUND = 18;

export type ParsedBet = {
  type: "max" | "min" | "generic";
  label: string;
  target: number | null;
  targetDisplay: string;
};

export function parseBetType(text: string): ParsedBet {
  const t = (text || "").trim();
  let m: RegExpMatchArray | null;

  if ((m = t.match(/^(-?\d+|E)\s+or better$/i))) {
    const val = /^E$/i.test(m[1]) ? 0 : parseInt(m[1], 10);
    return { type: "max", label: "SCORE", target: val, targetDisplay: "≤ " + (/^E$/i.test(m[1]) ? "E" : m[1]) };
  }
  if ((m = t.match(/^(-?\d+|E)\s+or worse$/i))) {
    const val = /^E$/i.test(m[1]) ? 0 : parseInt(m[1], 10);
    return { type: "min", label: "SCORE", target: val, targetDisplay: "≥ " + (/^E$/i.test(m[1]) ? "E" : m[1]) };
  }
  if ((m = t.match(/^(\d+)\+\s*greens$/i))) {
    return { type: "min", label: "GIR", target: parseInt(m[1], 10), targetDisplay: "≥ " + m[1] };
  }
  if ((m = t.match(/^(\d+)\s*greens or less$/i))) {
    return { type: "max", label: "GIR", target: parseInt(m[1], 10), targetDisplay: "≤ " + m[1] };
  }
  if ((m = t.match(/^(\d+)\s*birdies or less$/i))) {
    return { type: "max", label: "BIRDIES", target: parseInt(m[1], 10), targetDisplay: "≤ " + m[1] };
  }
  if ((m = t.match(/^(\d+)\s*bogeys or less$/i))) {
    return { type: "max", label: "BOGEYS", target: parseInt(m[1], 10), targetDisplay: "≤ " + m[1] };
  }
  return { type: "generic", label: "STAT", target: null, targetDisplay: "—" };
}

export function trend(parsed: ParsedBet, stat: number | null, thru: number | null): "good" | "bad" | "neutral" {
  if (parsed.type === "generic" || stat === null || stat === undefined || isNaN(stat)) return "neutral";
  if (parsed.type === "max") {
    return stat <= (parsed.target as number) ? "good" : "bad";
  }
  if (parsed.type === "min") {
    if (stat >= (parsed.target as number)) return "good";
    if (thru !== null && thru !== undefined && !isNaN(thru) && thru >= HOLES_IN_ROUND) return "bad";
    return "neutral";
  }
  return "neutral";
}

export function timeToMinutes(tstr: string): number {
  const m = tstr.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!m) return 9999;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const ap = m[3].toUpperCase();
  if (ap === "AM") { if (h === 12) h = 0; } else { if (h !== 12) h += 12; }
  return h * 60 + min;
}

// Given a parsed bet type and a computed AutoStats snapshot, return the
// value that belongs in this bet's "Stat" cell.
export function autoStatValue(
  parsed: ParsedBet,
  auto: { scoreToPar: number | null; gir: string | null; fairways: string | null; birdies: number | null; bogeys: number | null } | null | undefined
): number | null {
  if (!auto) return null;
  if (parsed.label === "SCORE") return auto.scoreToPar;
  if (parsed.label === "GIR") {
    const m = auto.gir?.match(/(\d+)/);
    return m ? parseInt(m[1], 10) : null;
  }
  if (parsed.label === "BIRDIES") return auto.birdies;
  if (parsed.label === "BOGEYS") return auto.bogeys;
  return null;
}
