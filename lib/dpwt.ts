// DP World Tour (europeantour.com) integration.
//
// CONFIRMED from a real DevTools capture (Danish Golf Championship 2026):
// the site's GraphQL backend returns full-field, hole-by-hole scores with
// par via a "getGolfTournamentGroupScores" query - one call for the whole
// field, same shape whether it's a live round or a finished one:
//
//   { groupId, l1Course, teamId, players: [{ id, lastName, firstName }],
//     roundScores: [{ courseId, roundNo, toParToday: {value}, startHole,
//       holes: [{ holePar, holeStrokes, holeOrder, holeNumber }], isPlayoff }],
//     toPar: {value}, currentHole, tournamentPosition: {format, value, displayValue},
//     status }
//
// NOT YET CONFIRMED: the actual request URL/endpoint this query is sent
// to. The site defaults to a WebSocket subscription
// (ShotTrackerSubscribeToGolfTournamentGroupScores) while a round is live,
// which doesn't show up as a normal Fetch/XHR request - only the query
// form's plain HTTP request (used for completed/historical rounds) would.
// Per the project's standing rule, never guess an external API shape or
// endpoint - fetchDpwtTournamentGroupScores below is a stub until a real
// capture confirms the URL, method, and request body for that HTTP form.
//
// Fairways-hit and GIR are NOT covered by this endpoint at all - that data
// only exists in a separate shot-by-shot feed (confirmed query name:
// ShotFeedGetGolfTournamentTeamsShotFeed / its live subscription
// counterpart) which is sent as compressed binary WebSocket frames we
// haven't been able to decode from DevTools alone. Fairways/GIR bets on
// this tour are graded by hand, same as WINNER_SCORE bets already are -
// see the dataSource === "dpwt" checks in sync/route.ts.

export type DpwtHole = {
  holePar: number;
  holeStrokes: number | null;
  holeOrder: number;
  holeNumber: number;
};

export type DpwtRoundScore = {
  courseId: number;
  roundNo: number;
  toParToday: { value: number } | null;
  holesThrough: { value: number } | null;
  startHole: number;
  holes: DpwtHole[];
  isPlayoff: boolean;
};

export type DpwtPlayer = { id: number; lastName: string; firstName: string };

export type DpwtGroupScore = {
  groupId: number;
  l1Course: boolean;
  teamId: number;
  players: DpwtPlayer[];
  roundScores: DpwtRoundScore[];
  toPar: { value: number } | null;
  currentHole: number;
  tournamentPosition: { format: string; value: number; displayValue: string } | null;
  status: string; // e.g. "Uncut", "Cut" - haven't seen every possible value yet
};

export type DpwtRoundSummary = {
  thru: number;
  scoreToPar: number;
  birdies: number;
  eagles: number;
  pars: number;
  bogeys: number;
  doubleBogeys: number;
  birdiesOrBetter: number;
  bogeysOrWorse: number;
};

// Same score-minus-par derivation already used for PGA Tour (never the
// aggregate stats section - there isn't one here anyway, this endpoint
// only ever gives strokes+par per hole, so there's nothing else to derive
// from).
export function summarizeDpwtRound(round: DpwtRoundScore): DpwtRoundSummary {
  let thru = 0, birdies = 0, eagles = 0, pars = 0, bogeys = 0, doubleBogeys = 0, scoreToPar = 0;
  for (const h of round.holes) {
    if (h.holeStrokes === null || h.holeStrokes === undefined) continue;
    thru += 1;
    const diff = h.holeStrokes - h.holePar;
    scoreToPar += diff;
    if (diff <= -2) eagles++;
    else if (diff === -1) birdies++;
    else if (diff === 0) pars++;
    else if (diff === 1) bogeys++;
    else doubleBogeys++;
  }
  return {
    thru, scoreToPar, birdies, eagles, pars, bogeys, doubleBogeys,
    birdiesOrBetter: birdies + eagles, bogeysOrWorse: bogeys + doubleBogeys,
  };
}

export function findDpwtRoundByNumber(group: DpwtGroupScore, roundNo: number): DpwtRoundScore | null {
  return group.roundScores.find((r) => r.roundNo === roundNo && !r.isPlayoff) ?? null;
}

// STUB - see the file header comment. Needs a confirmed request URL/body
// before this can actually fetch anything. Throws clearly rather than
// guessing, so a caller can't accidentally ship on a silently-wrong URL.
export async function fetchDpwtTournamentGroupScores(tournamentId: string): Promise<DpwtGroupScore[]> {
  throw new Error(
    "fetchDpwtTournamentGroupScores is not wired up yet - the getGolfTournamentGroupScores " +
    "request URL hasn't been confirmed via DevTools capture. See lib/dpwt.ts header comment."
  );
}
