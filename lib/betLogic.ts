export const HOLES_IN_ROUND = 18;
export const HOLES_IN_NINE = 9;

export type ParsedBet = {
  type: "max" | "min" | "generic";
  label: string;
  target: number | null;
  targetDisplay: string;
  segment?: "front9" | "back9"; // set only for a 9-hole-segment SCORE bet -
                                 // holes 1-9 or 10-18 by literal hole number,
                                 // never "whichever nine was played first"
  topN?: number; // TOP_N personal bets only - the N in "Top N"
  h2hOpponent?: string; // H2H personal bets only - the other named player
  h2hScope?: "round" | "tournament"; // H2H personal bets only
  h2hRoundNum?: number; // H2H personal bets only, when h2hScope is "round"
};

export function parseBetType(text: string): ParsedBet {
  const t = (text || "").trim();
  let m: RegExpMatchArray | null;

  // Personal plays (see lib/parsePersonal.ts) - all four are "generic" type
  // since none of them grade off a stat/thru bound the way SCORE/GIR/etc
  // do: Winner and Top N settle by hand, Make Cut and H2H auto-grade via
  // their own bespoke logic in the sync route (see gradeMakeCut below and
  // the H2H handling in app/api/sync/route.ts), not autoGradeStatus.
  if ((m = t.match(/^h2h vs (.+?) \(round (\d+)\)$/i))) {
    return { type: "generic", label: "H2H", target: null, targetDisplay: "—", h2hOpponent: m[1].trim(), h2hScope: "round", h2hRoundNum: parseInt(m[2], 10) };
  }
  if ((m = t.match(/^h2h vs (.+?) \(tournament\)$/i))) {
    return { type: "generic", label: "H2H", target: null, targetDisplay: "—", h2hOpponent: m[1].trim(), h2hScope: "tournament" };
  }
  // Tie matchups reuse H2H's opponent/scope fields (h2hOpponent/h2hScope/
  // h2hRoundNum) since the shape is identical - only the win condition
  // differs (exact equality, not "better score"), which the sync route
  // branches on via the label.
  if ((m = t.match(/^tie vs (.+?) \(round (\d+)\)$/i))) {
    return { type: "generic", label: "TIE", target: null, targetDisplay: "—", h2hOpponent: m[1].trim(), h2hScope: "round", h2hRoundNum: parseInt(m[2], 10) };
  }
  if ((m = t.match(/^tie vs (.+?) \(tournament\)$/i))) {
    return { type: "generic", label: "TIE", target: null, targetDisplay: "—", h2hOpponent: m[1].trim(), h2hScope: "tournament" };
  }
  if ((m = t.match(/^top\s+(\d+)$/i))) {
    return { type: "generic", label: "TOP_N", target: null, targetDisplay: "—", topN: parseInt(m[1], 10) };
  }
  if ((m = t.match(/^winner$/i))) {
    return { type: "generic", label: "WINNER", target: null, targetDisplay: "—" };
  }
  if ((m = t.match(/^make\s*cut$/i))) {
    return { type: "generic", label: "MAKE_CUT", target: null, targetDisplay: "—" };
  }

  if ((m = t.match(/^front 9:\s*([+-]?\d+|E)\s+or better$/i))) {
    const val = /^E$/i.test(m[1]) ? 0 : parseInt(m[1], 10);
    return { type: "max", label: "SCORE", segment: "front9", target: val, targetDisplay: "≤ " + (/^E$/i.test(m[1]) ? "E" : m[1]) };
  }
  if ((m = t.match(/^front 9:\s*([+-]?\d+|E)\s+or worse$/i))) {
    const val = /^E$/i.test(m[1]) ? 0 : parseInt(m[1], 10);
    return { type: "min", label: "SCORE", segment: "front9", target: val, targetDisplay: "≥ " + (/^E$/i.test(m[1]) ? "E" : m[1]) };
  }
  if ((m = t.match(/^back 9:\s*([+-]?\d+|E)\s+or better$/i))) {
    const val = /^E$/i.test(m[1]) ? 0 : parseInt(m[1], 10);
    return { type: "max", label: "SCORE", segment: "back9", target: val, targetDisplay: "≤ " + (/^E$/i.test(m[1]) ? "E" : m[1]) };
  }
  if ((m = t.match(/^back 9:\s*([+-]?\d+|E)\s+or worse$/i))) {
    const val = /^E$/i.test(m[1]) ? 0 : parseInt(m[1], 10);
    return { type: "min", label: "SCORE", segment: "back9", target: val, targetDisplay: "≥ " + (/^E$/i.test(m[1]) ? "E" : m[1]) };
  }
  if ((m = t.match(/^([+-]?\d+|E)\s+or better$/i))) {
    const val = /^E$/i.test(m[1]) ? 0 : parseInt(m[1], 10);
    return { type: "max", label: "SCORE", target: val, targetDisplay: "≤ " + (/^E$/i.test(m[1]) ? "E" : m[1]) };
  }
  if ((m = t.match(/^([+-]?\d+|E)\s+or worse$/i))) {
    const val = /^E$/i.test(m[1]) ? 0 : parseInt(m[1], 10);
    return { type: "min", label: "SCORE", target: val, targetDisplay: "≥ " + (/^E$/i.test(m[1]) ? "E" : m[1]) };
  }
  if ((m = t.match(/^(\d+)\+\s*greens$/i))) {
    return { type: "min", label: "GIR", target: parseInt(m[1], 10), targetDisplay: "≥ " + m[1] };
  }
  if ((m = t.match(/^(\d+)\s*greens or less$/i))) {
    return { type: "max", label: "GIR", target: parseInt(m[1], 10), targetDisplay: "≤ " + m[1] };
  }
  if ((m = t.match(/^(\d+)\+\s*birdies$/i))) {
    return { type: "min", label: "BIRDIES", target: parseInt(m[1], 10), targetDisplay: "≥ " + m[1] };
  }
  if ((m = t.match(/^(\d+)\s*birdies or less$/i))) {
    return { type: "max", label: "BIRDIES", target: parseInt(m[1], 10), targetDisplay: "≤ " + m[1] };
  }
  if ((m = t.match(/^(\d+)\+\s*bogeys$/i))) {
    return { type: "min", label: "BOGEYS", target: parseInt(m[1], 10), targetDisplay: "≥ " + m[1] };
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
  const holesTotal = parsed.segment ? HOLES_IN_NINE : HOLES_IN_ROUND;
  if (parsed.type === "max") {
    return stat <= (parsed.target as number) ? "good" : "bad";
  }
  if (parsed.type === "min") {
    if (stat >= (parsed.target as number)) return "good";
    if (thru !== null && thru !== undefined && !isNaN(thru) && thru >= holesTotal) return "bad";
    return "neutral";
  }
  return "neutral";
}

const COUNT_LABELS = ["GIR", "BIRDIES", "BOGEYS", "PARS"];

// For count-based bets (greens/birdies/bogeys/pars), compares the pace
// you're actually keeping (stat so far ÷ holes played) against the pace
// you'd need to sustain to hit the target (target ÷ 18) - a 3-point
// percentage buffer either side of that required pace gives green/yellow/
// red instead of just green/red, so you get an early read well before the
// round's worst/best-case bound would otherwise kick in. Round score and
// the tournament-winner bet fall back to the simpler trend() above, since
// "percent of holes" doesn't map cleanly onto a to-par number.
export function smartTrend(
  parsed: ParsedBet,
  stat: number | null,
  thru: number | null,
  holesTotal = HOLES_IN_ROUND
): "good" | "warn" | "bad" | "neutral" {
  if (!COUNT_LABELS.includes(parsed.label)) return trend(parsed, stat, thru);
  if (parsed.type === "generic" || parsed.target === null || parsed.target === undefined) return "neutral";
  if (stat === null || stat === undefined || isNaN(stat)) return "neutral";
  if (thru === null || thru === undefined || isNaN(thru) || thru <= 0) return "neutral";

  const requiredRate = parsed.target / holesTotal;
  const currentRate = stat / thru;
  const buffer = 0.03; // ~3 percentage points

  if (parsed.type === "min") {
    if (currentRate >= requiredRate + buffer) return "good";
    if (currentRate <= requiredRate - buffer) return "bad";
    return "warn";
  }
  // max type - lower pace than required is good, higher is bad (inverted)
  if (currentRate <= requiredRate - buffer) return "good";
  if (currentRate >= requiredRate + buffer) return "bad";
  return "warn";
}

// Returns the actual CSS class to use for a stat value - the new green/
// yellow/red pace scheme for count-based bets, or the existing gold/red/
// cream scheme for score bets (unchanged, since "good" there doesn't mean
// the same thing as an actual win).
export function trendClassName(
  parsed: ParsedBet,
  stat: number | null,
  thru: number | null,
  holesTotal = HOLES_IN_ROUND
): string {
  if (COUNT_LABELS.includes(parsed.label)) {
    return `pace-${smartTrend(parsed, stat, thru, holesTotal)}`;
  }
  return `trend-${trend(parsed, stat, thru)}`;
}

// Turns the internal category name into the word used in the UI - shared by
// the target column, the stat column, and the detail strip so they all agree.
export function friendlyLabel(label: string, segment?: "front9" | "back9"): string {
  if (label === "SCORE" && segment === "front9") return "Front 9";
  if (label === "SCORE" && segment === "back9") return "Back 9";
  switch (label) {
    case "SCORE": return "Score";
    case "GIR": return "Greens";
    case "BIRDIES": return "Birdies";
    case "BOGEYS": return "Bogeys";
    case "PARS": return "Pars";
    case "WINNER_SCORE": return "Winner";
    case "WINNER": return "Winner";
    case "TOP_N": return "Top N";
    case "MAKE_CUT": return "Make Cut";
    case "H2H": return "H2H";
    case "TIE": return "Tie";
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

  const effectiveHolesTotal = parsed.segment ? HOLES_IN_NINE : holesTotal;

  // Round score can move either direction on any hole, so it's only safe to
  // grade once the round (or the 9-hole segment) is actually finished - a
  // direct final comparison, not a worst/best-case bound.
  if (parsed.label === "SCORE") {
    if (thru < effectiveHolesTotal) return null;
    if (parsed.type === "max") return stat <= parsed.target ? "hit" : "miss";
    if (parsed.type === "min") return stat >= parsed.target ? "hit" : "miss";
    return null;
  }

  const remaining = effectiveHolesTotal - thru;
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

// Bespoke grading for personal "Make Cut" bets - deliberately kept outside
// autoGradeStatus (which refuses all "generic"-type bets, personal plays
// included) since this needs the tournament's cutLine, which isn't part of
// the bet phrase itself, only the mapping. Round 1 busting the cutline on
// its own is an immediate, guaranteed miss regardless of round 2 (strokes
// only ever add to the total, never subtract) - so that direction never
// waits on round 2 data existing at all. The hit direction, and any miss
// caused by round 2 alone, both require round 2 to be fully finished
// before grading - never guessed at mid-round.
export function gradeMakeCut(
  round1: { thru: number | null; scoreToPar: number | null },
  round2: { thru: number | null; scoreToPar: number | null },
  cutLine: number | null | undefined
): "hit" | "miss" | null {
  if (cutLine === null || cutLine === undefined) return null; // cut not announced/entered yet
  if (round1.thru !== 18 || round1.scoreToPar === null) return null; // round 1 itself not finished yet

  if (round1.scoreToPar > cutLine) return "miss"; // busts the line on round 1 alone - can't be undone

  if (round2.thru === 18 && round2.scoreToPar !== null) {
    const combined = round1.scoreToPar + round2.scoreToPar;
    return combined <= cutLine ? "hit" : "miss";
  }

  return null; // within the line after round 1, waiting on round 2 to finish
}

// Formats an H2H/Tie matchup's live status the way match play is actually
// described - "Up 2", "Down 1", "All Square" - rather than two raw scores
// side by side. A positive diff (opponent's score minus the subject's)
// means the subject is ahead, since a lower score is better in golf. Used
// for both H2H (where being "up" is the point) and Tie bets (where seeing
// exactly how far from level you are is still the useful signal).
export function matchPlayStatus(subjectScoreToPar: number | null | undefined, opponentScoreToPar: number | null | undefined): string {
  if (subjectScoreToPar === null || subjectScoreToPar === undefined || opponentScoreToPar === null || opponentScoreToPar === undefined) {
    return "—";
  }
  const diff = opponentScoreToPar - subjectScoreToPar;
  if (diff === 0) return "All Square";
  return diff > 0 ? `Up ${diff}` : `Down ${Math.abs(diff)}`;
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
