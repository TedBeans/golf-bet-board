import { AutoStats } from "./seed";

function findStat(statList: any[], ...fragments: string[]): string | null {
  for (const frag of fragments) {
    const s = statList.find((x: any) =>
      String(x?.name || x?.displayName || "").toLowerCase().includes(frag)
    );
    if (s) return s.displayValue ?? (s.value != null ? String(s.value) : null);
  }
  return null;
}

// Extracts the numerator out of a "10/14" style stat string, if present.
export function statNumerator(s: string | null): number | null {
  if (!s) return null;
  const m = s.match(/(\d+)\s*\/\s*\d+/);
  if (m) return parseInt(m[1], 10);
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

export function computeRoundStats(playerSummaryJson: any, roundNumber: number): AutoStats | null {
  const rounds: any[] =
    playerSummaryJson?.rounds ||
    playerSummaryJson?.athlete?.rounds ||
    playerSummaryJson?.player?.rounds ||
    [];

  const round =
    rounds.find((r: any) => (r?.period ?? r?.number) === roundNumber) ||
    rounds[roundNumber - 1] ||
    null;

  if (!round) return null;

  const linescores: any[] = round.linescores || round.holes || [];

  let thru = 0;
  let scoreToPar = 0;
  let birdies = 0;
  let bogeys = 0;
  let pars = 0;
  let eagles = 0;
  let doubleBogeys = 0;

  linescores.forEach((h: any) => {
    const strokes = h.value ?? h.strokes ?? h.score;
    const par = h.par;
    if (strokes === null || strokes === undefined) return; // hole not yet played
    thru += 1;
    if (par !== null && par !== undefined) scoreToPar += strokes - par;

    const typeLabel = String(
      h.scoreType?.name || h.scoreType?.abbreviation || h.scoreType || ""
    ).toLowerCase();

    if (typeLabel.includes("double")) doubleBogeys += 1;
    else if (typeLabel.includes("bogey")) bogeys += 1;
    else if (typeLabel.includes("eagle")) eagles += 1;
    else if (typeLabel.includes("birdie")) birdies += 1;
    else if (typeLabel.includes("par")) pars += 1;
  });

  const statList: any[] = round.statistics || round.stats || [];
  const gir = findStat(statList, "greens in regulation", "gir");
  const fairways = findStat(statList, "fairways hit", "driving accuracy");

  return {
    thru,
    scoreToPar,
    birdies,
    bogeys,
    pars,
    eagles,
    doubleBogeys,
    gir,
    fairways,
    updatedAt: new Date().toISOString(),
  };
}

export function roundNumberFromLabel(label: string): number {
  const m = label.match(/(\d+)/);
  return m ? parseInt(m[1], 10) : 1;
}
