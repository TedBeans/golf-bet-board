export type ScorecardRoundStats = {
  birdies: number | null; // literal birdie count - for display only
  bogeys: number | null; // literal bogey count - for display only
  eagles: number | null; // eagles/albatrosses - for display only
  doubleBogeys: number | null; // double-bogey-or-worse - for display only
  birdiesOrBetter: number | null; // birdies + eagles - use this for "X birdies or less/better" grading
  bogeysOrWorse: number | null; // bogeys + doubles - use this for "X bogeys or less/worse" grading
  pars: number | null;
  gir: string | null; // raw display, e.g. "72.22% (13/18)"
  girCount: number | null; // e.g. 13
  fairways: string | null; // raw display, e.g. "64.29% (9/14)"
  fairwaysCount: number | null; // e.g. 9
  thruCount: number | null; // holes completed this round, derived from hole-by-hole data;
                             // 18 when the round is fully finished even if the leaderboard
                             // returns "-" (null) for thru (see parseThru in pgaMatch.ts)
};

function findLabel(list: any[], ...labels: string[]): string | null {
  for (const label of labels) {
    const item = (list || []).find((x: any) => x.label === label);
    if (item) return item.total;
  }
  return null;
}

// PGA Tour represents "zero occurrences so far" as a dash, an empty string,
// or by omitting the stat row entirely - all of those should read as 0, not
// as "we don't have this yet", so counting bets grade correctly.
function parseCountValue(str: string | null): number {
  if (str === null || str === undefined) return 0;
  const t = str.trim();
  if (t === "" || t === "-" || t === "\u2014") return 0;
  const n = parseInt(t, 10);
  return isNaN(n) ? 0 : n;
}

// Pulls the numerator out of PGA Tour's "72.22% (13/18)" style display strings.
function numeratorOf(display: string | null): number | null {
  if (!display) return null;
  const trimmed = display.trim();
  if (trimmed === "-" || trimmed === "\u2014") return 0;
  const m = trimmed.match(/\((\d+)\s*\/\s*\d+\)/) || trimmed.match(/(\d+)\s*\/\s*\d+/);
  if (m) return parseInt(m[1], 10);
  const n = parseInt(trimmed, 10);
  return isNaN(n) ? null : n;
}

// Strips the leading percentage off "72.22% (13/18)", leaving just "13/18".
function fractionOnly(display: string | null): string | null {
  if (!display) return null;
  const m = display.match(/\((\d+\s*\/\s*\d+)\)/) || display.match(/(\d+\s*\/\s*\d+)/);
  return m ? m[1].replace(/\s+/g, "") : display;
}

export function extractScorecardStats(json: any, roundNumber: number): ScorecardRoundStats | null {
  const rounds: any[] = json?.rounds || [];
  const round = rounds.find((r: any) => r.round === String(roundNumber));
  if (!round) return null;

  const scoring: any[] = round.scoring || [];
  const performance: any[] = round.performance || [];

  const birdiesStr = findLabel(scoring, "Birdies");
  const bogeysStr = findLabel(scoring, "Bogeys");
  const parsStr = findLabel(scoring, "Pars");
  // Different possible labels PGA Tour might use for these - defensive,
  // since we haven't seen a live example of either yet.
  const eaglesStr = findLabel(scoring, "Eagles", "Eagle", "Eagles or Better", "Albatross");
  const doubleBogeysStr = findLabel(scoring, "Double Bogeys", "Double Bogey", "Doubles", "Double Bogey or Worse", "Others");
  const girDisplay = findLabel(performance, "Greens in Regulation");
  const fairwaysDisplay = findLabel(performance, "Driving Accuracy");

  const birdies = parseCountValue(birdiesStr);
  const bogeys = parseCountValue(bogeysStr);
  const eagles = parseCountValue(eaglesStr);
  const doubleBogeys = parseCountValue(doubleBogeysStr);

  return {
    birdies,
    bogeys,
    eagles,
    doubleBogeys,
    birdiesOrBetter: birdies + eagles,
    bogeysOrWorse: bogeys + doubleBogeys,
    pars: parseCountValue(parsStr),
    gir: fractionOnly(girDisplay),
    girCount: numeratorOf(girDisplay),
    fairways: fractionOnly(fairwaysDisplay),
    fairwaysCount: numeratorOf(fairwaysDisplay),
    // Count finalized holes directly from the scoring data - this is 18
    // for a player who has finished, even if the leaderboard returns "-"
    // for thru (which parseThru converts to null). Derived from the
    // scoring array which has one entry per hole, each with a totalStrokes
    // value once the hole is complete.
    thruCount: scoring.filter((h: any) => h.totalStrokes != null && h.totalStrokes > 0).length || null,
  };
}

export function roundNumberFromLabel(label: string): number {
  const m = (label || "").match(/(\d+)/);
  return m ? parseInt(m[1], 10) : 1;
}

// Front 9 / Back 9 score bets need literal hole numbers 1-9 or 10-18 -
// never "whichever nine was played first" (a shotgun start can mean the
// group's actual front nine of the day was holes 10-18). Uses the same
// hole-by-hole data as the scorecard popover, just filtered by hole number
// instead of split by play order.
export function computeSegmentStats(
  json: any,
  roundNumber: number,
  segment: "front9" | "back9"
): { thru: number; scoreToPar: number } | null {
  const rounds: any[] = json?.roundScores || [];
  const round = rounds.find((r: any) => r.roundNumber === roundNumber);
  if (!round) return null;

  const allHoles = [...(round.firstNine?.holes || []), ...(round.secondNine?.holes || [])];
  const lo = segment === "front9" ? 1 : 10;
  const hi = segment === "front9" ? 9 : 18;
  const inRange = allHoles.filter((h: any) => h.holeNumber >= lo && h.holeNumber <= hi);

  let thru = 0;
  let scoreToPar = 0;
  for (const h of inRange) {
    if (h.score && h.score !== "-") {
      thru += 1;
      scoreToPar += parseInt(h.score, 10) - h.par;
    }
  }
  return { thru, scoreToPar };
}

// Full-round (all 18 holes) equivalent of computeSegmentStats above - used
// by personal Make Cut and round-scoped H2H bets, which need a specific
// round's thru/score-to-par regardless of which round is currently "active"
// tournament-wide (unlike the regular leaderboard row's score/thru, which
// only ever reflects whatever round is live right now). Kept as a separate
// function rather than making segment optional on computeSegmentStats, so
// that already-shipped function's signature never has to change.
export function computeFullRoundStats(json: any, roundNumber: number): { thru: number; scoreToPar: number } | null {
  const rounds: any[] = json?.roundScores || [];
  const round = rounds.find((r: any) => r.roundNumber === roundNumber);
  if (!round) return null;

  const allHoles = [...(round.firstNine?.holes || []), ...(round.secondNine?.holes || [])];

  let thru = 0;
  let scoreToPar = 0;
  for (const h of allHoles) {
    if (h.score && h.score !== "-") {
      thru += 1;
      scoreToPar += parseInt(h.score, 10) - h.par;
    }
  }
  return { thru, scoreToPar };
}

export type HoleScore = { hole: number; par: number; score: number | null; status: string | null };
export type HoleScorecard = {
  firstNine: HoleScore[]; // whichever nine was actually played first
  firstNineLabel: string; // "OUT" or "IN"
  secondNine: HoleScore[];
  secondNineLabel: string;
};

function mapHoles(holes: any[]): HoleScore[] {
  return holes
    .map((h) => ({
      hole: h.holeNumber,
      par: h.par,
      score: h.score && h.score !== "-" ? parseInt(h.score, 10) : null,
      status: h.status ?? null,
    }))
    .sort((a, b) => a.hole - b.hole);
}

// Pulls one round's 18 holes out of the ScorecardCompressedV3 payload, kept
// in the order actually played - a shotgun start means holes 10-18 can be
// the front nine of the day, so "firstNine"/"secondNine" here always means
// chronological order, not hole 1-9 vs 10-18.
export function extractHoleScores(json: any, roundNumber: number): HoleScorecard | null {
  const rounds: any[] = json?.roundScores || [];
  const round = rounds.find((r: any) => r.roundNumber === roundNumber);
  if (!round) return null;

  const firstNine: any[] = round.firstNine?.holes || [];
  const secondNine: any[] = round.secondNine?.holes || [];
  if (firstNine.length === 0 && secondNine.length === 0) return null;

  return {
    firstNine: mapHoles(firstNine),
    firstNineLabel: round.firstNine?.totalLabel || "OUT",
    secondNine: mapHoles(secondNine),
    secondNineLabel: round.secondNine?.totalLabel || "IN",
  };
}
