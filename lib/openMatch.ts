export type OpenHole = { holeId: number; holePar: number; playerPar: number; playerStrokes: number };
export type OpenRound = { id: number; outPar: number; inPar: number; totalPar: number; teeTime: string; info: OpenHole[] };
export type OpenPlayerRow = {
  id: string;
  firstName: string;
  lastName: string;
  displayName: string;
  rounds: OpenRound[];
  currentRound: number | null; // which round this player is actively playing right now
  currentHole: number | null; // which hole within currentRound is in progress - NOT yet
                               // finished, so its playerStrokes (even if nonzero) is a live,
                               // still-changing count as they play it, not a final score.
                               // Without this, a hole in progress can transiently look like a
                               // completed eagle/albatross before the player has even holed out.
};

export function extractOpenPlayers(traditionalJson: any): OpenPlayerRow[] {
  const rows: any[] = traditionalJson?.players || [];
  return rows.map((r) => {
    const parsedHole = parseInt(r.hole, 10);
    return {
      id: String(r.id ?? ""),
      firstName: r.firstName || "",
      lastName: r.lastName || "",
      displayName: `${r.firstName || ""} ${r.lastName || ""}`.trim(),
      rounds: r.rounds || [],
      currentRound: typeof r.currentRound === "number" ? r.currentRound : null,
      currentHole: isNaN(parsedHole) ? null : parsedHole,
    };
  });
}

function norm(s: string): string {
  return s.toLowerCase().replace(/\./g, "").trim();
}

// Same matching strategy as lib/pgaMatch.ts's findPlayerMatch (exact, then
// last-name, then last-name prefix, then substring) - kept as a separate
// copy rather than sharing code because the two source shapes are
// different enough (displayName vs firstName/lastName) that forcing a
// shared function would need its own adapter layer anyway.
export function findOpenPlayerMatch(betPlayerName: string, players: OpenPlayerRow[]): OpenPlayerRow | null {
  const target = norm(betPlayerName);
  const tokens = target.split(/\s+/);
  const lastToken = tokens[tokens.length - 1];

  let match = players.find((p) => norm(p.displayName) === target);
  if (match) return match;

  match = players.find((p) => norm(p.lastName) === lastToken);
  if (match) return match;

  match = players.find((p) => {
    const pLast = norm(p.lastName);
    return pLast.length > 2 && lastToken.length > 2 && (pLast.startsWith(lastToken) || lastToken.startsWith(pLast));
  });
  if (match) return match;

  match = players.find((p) => norm(p.displayName).includes(target) || target.includes(norm(p.lastName)));
  return match || null;
}

export type OpenDerivedStats = {
  thru: number | null;
  scoreToPar: number | null;
  totalToPar: number;
  birdies: number;
  eagles: number;
  pars: number;
  bogeys: number;
  doubleBogeys: number;
  birdiesOrBetter: number;
  bogeysOrWorse: number;
  holesPlayed: number;
};

// Derives every count-based stat directly from hole-by-hole strokes vs par
// - no separate stats call needed, since theopen.com's traditional feed
// already carries holePar + playerStrokes per hole. This covers SCORE,
// BIRDIES, BOGEYS, and PARS bets completely. GIR is the one stat this
// can't produce (reaching the green in regulation isn't derivable from
// total strokes alone) - that has to come from the statistics feed's
// per-player breakdown, if it turns out to have one once live.
//
// roundNumber: pass a specific round (1-4) to get that round's thru/score;
// pass null to aggregate across every round played so far (used by
// findOpenLeader for the tournament total).
// holeRange: optional [lo, hi] to restrict to literal hole numbers (e.g.
// [1,9] for a Front 9 bet, [10,18] for Back 9) - never "whichever nine was
// played first", since a shotgun start can mean the group's actual front
// nine of the day was holes 10-18.
export function computeOpenStats(
  player: OpenPlayerRow,
  roundNumber: number | null,
  holeRange?: [number, number]
): OpenDerivedStats {
  const rounds = roundNumber === null ? player.rounds : player.rounds.filter((r) => r.id === roundNumber);

  let birdies = 0, eagles = 0, pars = 0, bogeys = 0, doubleBogeys = 0;
  let totalToPar = 0;
  let holesPlayed = 0;
  let thisRoundToPar = 0;
  let thisRoundThru = 0;

  for (const round of rounds) {
    // Only the round the player is CURRENTLY on has a "hole in progress" to
    // worry about - a fully-finished past round has no provisional data
    // left, and a not-yet-started future round is all zeros anyway.
    const isLiveRound = player.currentRound !== null && round.id === player.currentRound;
    for (const hole of round.info || []) {
      if (holeRange && (hole.holeId < holeRange[0] || hole.holeId > holeRange[1])) continue;
      // The hole currently in progress reports a live, still-changing
      // stroke count as the player plays it - not a final score. Counting
      // it early is exactly how a still-in-progress hole can transiently
      // look like a completed eagle/albatross before it's actually done.
      if (isLiveRound && player.currentHole !== null && hole.holeId >= player.currentHole) continue;
      if (!hole.playerStrokes || hole.playerStrokes <= 0) continue; // not played yet
      const diff = hole.playerStrokes - hole.holePar;
      totalToPar += diff;
      holesPlayed += 1;
      if (roundNumber !== null && round.id === roundNumber) {
        thisRoundToPar += diff;
        thisRoundThru += 1;
      }
      if (diff <= -2) eagles += 1;
      else if (diff === -1) birdies += 1;
      else if (diff === 0) pars += 1;
      else if (diff === 1) bogeys += 1;
      else if (diff >= 2) doubleBogeys += 1;
    }
  }

  return {
    thru: roundNumber !== null ? (thisRoundThru || null) : null,
    scoreToPar: roundNumber !== null ? (thisRoundThru > 0 ? thisRoundToPar : null) : null,
    totalToPar,
    birdies,
    eagles,
    pars,
    bogeys,
    doubleBogeys,
    birdiesOrBetter: birdies + eagles,
    bogeysOrWorse: bogeys + doubleBogeys,
    holesPlayed,
  };
}

// Same HoleScore/HoleScorecard shape as lib/pgaScorecard.ts's extractHoleScores,
// so HoleScorecardModal doesn't need to know which data source it came from -
// used by /api/scorecard when a tournament's dataSource is "theopen" instead
// of the PGA Tour default. Respects the same in-progress-hole rule as
// computeOpenStats above: the hole currently being played never shows a
// provisional score, even if playerStrokes has already ticked up.
export type OpenHoleScore = { hole: number; par: number; score: number | null; status: string | null };
export type OpenHoleScorecard = { firstNine: OpenHoleScore[]; firstNineLabel: string; secondNine: OpenHoleScore[]; secondNineLabel: string };

function openHoleStatus(diff: number): string {
  if (diff <= -2) return "EAGLE";
  if (diff === -1) return "BIRDIE";
  if (diff === 0) return "PAR";
  if (diff === 1) return "BOGEY";
  if (diff === 2) return "DOUBLE_BOGEY";
  return "OTHER";
}

export function extractOpenHoleScorecard(player: OpenPlayerRow, roundNumber: number): OpenHoleScorecard | null {
  const round = player.rounds.find((r) => r.id === roundNumber);
  if (!round) return null;
  const isLiveRound = player.currentRound !== null && round.id === player.currentRound;

  const toHoleScore = (h: OpenHole): OpenHoleScore => {
    const inProgress = isLiveRound && player.currentHole !== null && h.holeId >= player.currentHole;
    const played = !inProgress && typeof h.playerStrokes === "number" && h.playerStrokes > 0;
    if (!played) return { hole: h.holeId, par: h.holePar, score: null, status: null };
    const diff = h.playerStrokes - h.holePar;
    return { hole: h.holeId, par: h.holePar, score: h.playerStrokes, status: openHoleStatus(diff) };
  };

  const info = round.info || [];
  const firstNine = info.filter((h) => h.holeId <= 9).map(toHoleScore);
  const secondNine = info.filter((h) => h.holeId >= 10).map(toHoleScore);
  if (firstNine.length === 0 && secondNine.length === 0) return null;

  return { firstNine, firstNineLabel: "OUT", secondNine, secondNineLabel: "IN" };
}

// Tournament leader (lowest total-to-par across all rounds played so far) -
// for WINNER_SCORE bets, same role as pgaMatch.ts's findLeader.
export function findOpenLeader(players: OpenPlayerRow[]): { player: OpenPlayerRow; totalToPar: number } | null {
  let best: { player: OpenPlayerRow; totalToPar: number } | null = null;
  for (const p of players) {
    const stats = computeOpenStats(p, null);
    if (stats.holesPlayed === 0) continue;
    if (!best || stats.totalToPar < best.totalToPar) {
      best = { player: p, totalToPar: stats.totalToPar };
    }
  }
  return best;
}
