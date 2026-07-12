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
  if ((m = t.match(/^(\d+)\+\s*pars$/i))) {
    return { type: "min", label: "PARS", target: parseInt(m[1], 10), targetDisplay: "≥ " + m[1] };
  }
  if ((m = t.match(/^(\d+)\s*pars or less$/i))) {
    return { type: "max", label: "PARS", target: parseInt(m[1], 10), targetDisplay: "≤ " + m[1] };
  }
  if ((m = t.match(/^winning score\s+(-?\d+(?:\.\d+)?|E)\s+or\s+better$/i))) {
    const val = /^E$/i.test(m[1]) ? 0 : parseFloat(m[1]);
    return { type: "max", label: "WINNER_SCORE", target: val, targetDisplay: "≤ " + (/^E$/i.test(m[1]) ? "E" : m[1]) };
  }
  if ((m = t.match(/^winning score\s+(-?\d+(?:\.\d+)?|E)\s+or\s+worse$/i))) {
    const val = /^E$/i.test(m[1]) ? 0 : parseFloat(m[1]);
    return { type: "min", label: "WINNER_SCORE", target: val, targetDisplay: "≥ " + (/^E$/i.test(m[1]) ? "E" : m[1]) };
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

// Turns the internal category name into the word used in the UI - shared by
// the target column, the stat column, and the detail strip so they all agree.
export function friendlyLabel(label: string): string {
  switch (label) {
    case "SCORE": return "Score";
    case "GIR": return "Greens";
    case "BIRDIES": return "Birdies";
    case "BOGEYS": return "Bogeys";
    case "PARS": return "Pars";
    case "WINNER_SCORE": return "Score";
    default: return "Stat";
  }
}

// Count-based bets (GIR, birdies, bogeys) only ever move in one direction as
// holes are played - the count can't go down. That means once the best or
// worst possible final number is already decided relative to the target,
// the bet is mathematically locked regardless of what happens on the
// remaining holes. Round score is deliberately excluded: a score can go up
// or down on any hole, so it's never locked in until the round finishes.
export function autoGradeStatus(
  parsed: ParsedBet,
  stat: number | null,
  thru: number | null,
  holesTotal = 18
): "hit" | "miss" | null {
  if (parsed.type === "generic") return null;
  if (parsed.label === "WINNER_SCORE") return null; // always graded by hand
  if (stat === null || stat === undefined) return null;
  if (parsed.target === null || parsed.target === undefined) return null;
  if (thru === null || thru === undefined) return null;

  // Round score can move either direction on any hole, so it's only safe to
  // grade once the round is actually finished - a direct final comparison,
  // not a worst/best-case bound.
  if (parsed.label === "SCORE") {
    if (thru < holesTotal) return null;
    if (parsed.type === "max") return stat <= parsed.target ? "hit" : "miss";
    if (parsed.type === "min") return stat >= parsed.target ? "hit" : "miss";
    return null;
  }

  const remaining = holesTotal - thru;
  if (remaining < 0) return null;
  const worstCase = stat + remaining; // max the count could still reach

  if (parsed.type === "max") {
    // Bet wins if the final count ends at or under the target.
    if (stat > parsed.target) return "miss"; // already over, can't undo
    if (worstCase <= parsed.target) return "hit"; // can't exceed it even in the worst case
    return null;
  }
  if (parsed.type === "min") {
    // Bet wins if the final count reaches at least the target.
    if (stat >= parsed.target) return "hit"; // already there, can't lose it
    if (worstCase < parsed.target) return "miss"; // can't reach it even in the best case
    return null;
  }
  return null;
}

// Displays a to-par number the way golf actually reads it - "E" for even,
// "+3" for over, "-2" for under - while the underlying value stays a plain
// number (0, 3, -2) for all math and grading.
export function formatScore(n: number | null | undefined, emptyText = "\u2014"): string {
  if (n === null || n === undefined || isNaN(n)) return emptyText;
  if (n === 0) return "E";
  return n > 0 ? `+${n}` : `${n}`;
}

// Parses user-typed score input ("E", "+3", "-2", "3") back into a number.
export function parseScoreInput(v: string): number | null {
  const t = v.trim();
  if (t === "") return null;
  if (/^e$/i.test(t)) return 0;
  const n = parseInt(t.replace(/^\+/, ""), 10);
  return isNaN(n) ? null : n;
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
  auto: { scoreToPar: number | null; gir: string | null; fairways: string | null; birdies: number | null; bogeys: number | null; pars?: number | null } | null | undefined
): number | null {
  if (!auto) return null;
  if (parsed.label === "SCORE") return auto.scoreToPar;
  if (parsed.label === "GIR") {
    const m = auto.gir?.match(/(\d+)/);
    return m ? parseInt(m[1], 10) : null;
  }
  if (parsed.label === "BIRDIES") return auto.birdies;
  if (parsed.label === "BOGEYS") return auto.bogeys;
  if (parsed.label === "PARS") return auto.pars ?? null;
  return null;
}
