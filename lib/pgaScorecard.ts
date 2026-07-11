export type ScorecardRoundStats = {
  birdies: number | null;
  bogeys: number | null;
  pars: number | null;
  gir: string | null; // raw display, e.g. "72.22% (13/18)"
  girCount: number | null; // e.g. 13
  fairways: string | null; // raw display, e.g. "64.29% (9/14)"
  fairwaysCount: number | null; // e.g. 9
};

function findLabel(list: any[], label: string): string | null {
  const item = (list || []).find((x: any) => x.label === label);
  return item ? item.total : null;
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
  const girDisplay = findLabel(performance, "Greens in Regulation");
  const fairwaysDisplay = findLabel(performance, "Driving Accuracy");

  return {
    birdies: parseCountValue(birdiesStr),
    bogeys: parseCountValue(bogeysStr),
    pars: parseCountValue(parsStr),
    gir: fractionOnly(girDisplay),
    girCount: numeratorOf(girDisplay),
    fairways: fractionOnly(fairwaysDisplay),
    fairwaysCount: numeratorOf(fairwaysDisplay),
  };
}

export function roundNumberFromLabel(label: string): number {
  const m = (label || "").match(/(\d+)/);
  return m ? parseInt(m[1], 10) : 1;
}
