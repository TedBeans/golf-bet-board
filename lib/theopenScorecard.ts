// theopen.com's `statistics` feedType returned nothing during the
// practice-day capture (the tournament wasn't live yet), so its real shape
// is still unconfirmed. Rather than block bet grading on an endpoint we
// haven't seen actual data from, this derives birdie/bogey/par/eagle/
// double-bogey counts directly from the `traditional` feed's per-hole
// playerStrokes vs holePar - which is plain arithmetic and needs no extra
// fetch. If `statistics` turns out to carry something useful once live
// (confirmed GIR/driving-accuracy equivalents, say), swap it in for the
// fields this can't cover - but everything scoring-related below should
// already be solid without it.
//
// Known gap: GIR and fairways-hit have no equivalent in this feed at all
// (unlike PGA Tour's ScorecardStatsV3Compressed, which has explicit
// "Greens in Regulation" / "Driving Accuracy" rows). Bets of those types
// simply won't auto-grade for The Open until/unless `statistics` turns out
// to carry them - same conservative behavior as any other stat we can't
// compute, not a special case to handle differently.

export type TheOpenScorecardStats = {
  birdies: number | null;
  bogeys: number | null;
  eagles: number | null;
  doubleBogeys: number | null;
  birdiesOrBetter: number | null; // birdies + eagles+ - use this for "X birdies or less/better" grading
  bogeysOrWorse: number | null; // bogeys + doubles+ - use this for "X bogeys or less/worse" grading
  pars: number | null;
  gir: string | null; // always null for now - no source data
  girCount: number | null; // always null for now - no source data
  fairways: string | null; // always null for now - no source data
  fairwaysCount: number | null; // always null for now - no source data
};

export function deriveTheOpenScorecardStats(traditionalJson: any, playerId: string, roundNumber: number): TheOpenScorecardStats | null {
  const player = (traditionalJson?.players || []).find((p: any) => String(p.id) === String(playerId));
  if (!player) return null;
  const round = (player.rounds || []).find((r: any) => r.id === roundNumber);
  if (!round) return null;

  let birdies = 0;
  let bogeys = 0;
  let eagles = 0;
  let doubleBogeys = 0;
  let pars = 0;
  let anyPlayed = false;

  for (const h of round.info || []) {
    const strokes = h?.playerStrokes;
    if (typeof strokes !== "number" || strokes <= 0) continue; // not played yet
    anyPlayed = true;
    const diff = strokes - (h.holePar ?? 0);
    if (diff <= -2) eagles += 1;
    else if (diff === -1) birdies += 1;
    else if (diff === 0) pars += 1;
    else if (diff === 1) bogeys += 1;
    else if (diff >= 2) doubleBogeys += 1;
  }

  if (!anyPlayed) return null;

  return {
    birdies,
    bogeys,
    eagles,
    doubleBogeys,
    birdiesOrBetter: birdies + eagles,
    bogeysOrWorse: bogeys + doubleBogeys,
    pars,
    gir: null,
    girCount: null,
    fairways: null,
    fairwaysCount: null,
  };
}
