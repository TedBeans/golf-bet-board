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

// Pulls the numerator out of PGA Tour's "72.22% (13/18)" style display strings.
function numeratorOf(display: string | null): number | null {
  if (!display) return null;
  const m = display.match(/\((\d+)\s*\/\s*\d+\)/) || display.match(/(\d+)\s*\/\s*\d+/);
  if (m) return parseInt(m[1], 10);
  const n = parseInt(display, 10);
  return isNaN(n) ? null : n;
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
    birdies: birdiesStr !== null ? parseInt(birdiesStr, 10) : null,
    bogeys: bogeysStr !== null ? parseInt(bogeysStr, 10) : null,
    pars: parsStr !== null ? parseInt(parsStr, 10) : null,
    gir: girDisplay,
    girCount: numeratorOf(girDisplay),
    fairways: fairwaysDisplay,
    fairwaysCount: numeratorOf(fairwaysDisplay),
  };
}

export function roundNumberFromLabel(label: string): number {
  const m = (label || "").match(/(\d+)/);
  return m ? parseInt(m[1], 10) : 1;
}
