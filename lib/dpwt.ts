// DP World Tour (europeantour.com) integration.
//
// STRATEGY: the site's live GraphQL feed (getGolfTournamentGroupScores)
// looked promising for a single call covering the whole field, but the
// real captured request URL turned out to be
// "https://btec-http.services.srarena.io/?hash=3957876929" - a numeric
// hash of the query+variables computed client-side by their JS, not a
// stable parameterized endpoint. We can't reconstruct that hash for a
// different tournament/round/group without reverse-engineering their
// hashing function, which isn't something to build live grading on.
//
// So instead: use the OTHER confirmed endpoint, a plain predictable REST
// GET with no hash and no auth:
//
//   https://www.europeantour.com/api/sportdata/Scorecard/Strokeplay/Event/{eventId}/Player/{playerId}
//
// This returns one player's full tournament (every round, hole-by-hole
// strokes + a ScoreClass label) in one call - same per-player-fetch shape
// already used for PGA Tour's scorecard/GIR/fairways calls. Its only gaps
// are (a) no hole-par data, and (b) it needs each player's numeric
// playerId, which the free-text bet ("Ludvig Aberg") doesn't have.
//
// Neither of those change during the week, so both get seeded ONCE per
// tournament in Admin, from a pasted getGolfTournamentGroupScores capture
// (the exact same kind of DevTools capture already used to build this
// integration) - see parseDpwtRosterCapture below. After that, every sync
// just calls the plain REST endpoint per player, same as every other data
// source in this app.

export type DpwtHoleScore = {
  HoleNo: number;
  Strokes: number;
  ScoreClass: string; // "bi" | "pa" | "bo" | "ea" | "tb" | ... - real values
                       // confirmed from a capture, but not every possible
                       // value has been seen yet. Birdies/pars/bogeys/
                       // eagles/doubles are derived from Strokes - HolePar
                       // instead of trusting this field, same score-minus-
                       // par methodology used everywhere else in this app,
                       // so an unfamiliar ScoreClass value can't cause a
                       // silent mis-grade.
  IsAmScore: boolean;
  Penalty: number;
};

export type DpwtRound = {
  RoundNo: number;
  CourseNo: number;
  StrokesIn: number;
  StrokesOut: number;
  Strokes: number;
  ScoreToPar: number;
  Holes: DpwtHoleScore[];
};

export type DpwtScorecardResponse = {
  EventId: number;
  PlayerId: number;
  LastUpdated: string;
  TotalPenalty: number;
  Rounds: DpwtRound[];
};

// Confirmed via DevTools capture - plain GET, no auth, no hash.
export async function fetchDpwtPlayerScorecard(eventId: string, playerId: number): Promise<DpwtScorecardResponse> {
  const url = `https://www.europeantour.com/api/sportdata/Scorecard/Strokeplay/Event/${eventId}/Player/${playerId}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`DPWT scorecard fetch failed (${res.status}) for player ${playerId}`);
  return res.json();
}

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

// Same score-minus-par derivation used for PGA Tour and the roster-capture
// path below - holePars comes from the one-time Admin seed (see
// parseDpwtRosterCapture), indexed by hole number (1-18).
export function summarizeDpwtRound(round: DpwtRound, holePars: number[]): DpwtRoundSummary {
  let thru = 0, birdies = 0, eagles = 0, pars = 0, bogeys = 0, doubleBogeys = 0, scoreToPar = 0;
  for (const h of round.Holes) {
    const par = holePars[h.HoleNo - 1];
    if (par === undefined || h.Strokes === null || h.Strokes === undefined) continue;
    thru += 1;
    const diff = h.Strokes - par;
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

export function findDpwtRound(scorecard: DpwtScorecardResponse, roundNo: number): DpwtRound | null {
  return scorecard.Rounds.find((r) => r.RoundNo === roundNo) ?? null;
}

export type DpwtRosterSeed = {
  holePars: number[]; // index 0 = hole 1, length 18
  players: Record<string, number>; // "Firstname Lastname" -> numeric playerId
};

// One-time setup helper: pulls hole pars + a name->playerId roster out of a
// pasted getGolfTournamentGroupScores response (the exact JSON captured
// via DevTools while building this integration). Accepts either the full
// {"data":{"getGolfTournamentGroupScores":[...]}} wrapper or a bare
// groups array, and tolerates multiple such captures pasted one after
// another (e.g. one per tee-time group) - so Teddy can build up the
// roster incrementally as he captures more groups covering the players
// he's actually betting on, without needing the whole field at once.
export function parseDpwtRosterCapture(raw: string): DpwtRosterSeed {
  const parsed = JSON.parse(raw);
  const groups: any[] = Array.isArray(parsed)
    ? parsed
    : parsed?.data?.getGolfTournamentGroupScores ?? parsed?.getGolfTournamentGroupScores ?? [];

  if (!Array.isArray(groups) || groups.length === 0) {
    throw new Error("Couldn't find a getGolfTournamentGroupScores array in that paste.");
  }

  const players: Record<string, number> = {};
  let holePars: number[] | null = null;

  for (const group of groups) {
    for (const p of group.players ?? []) {
      if (p?.id && p?.firstName && p?.lastName) {
        players[`${p.firstName} ${p.lastName}`] = p.id;
      }
    }
    if (!holePars) {
      const round = (group.roundScores ?? []).find((r: any) => !r.isPlayoff && Array.isArray(r.holes) && r.holes.length === 18);
      if (round) {
        const pars = new Array(18).fill(undefined);
        for (const h of round.holes) pars[h.holeNumber - 1] = h.holePar;
        if (pars.every((p) => typeof p === "number")) holePars = pars;
      }
    }
  }

  if (!holePars) {
    throw new Error("Found players but couldn't extract a complete set of 18 hole pars from that paste.");
  }
  if (Object.keys(players).length === 0) {
    throw new Error("Found hole pars but no players with id/firstName/lastName in that paste.");
  }

  return { holePars, players };
}

export type DpwtTeeTimeEntry = { time: string; playerName: string };

// DP World Tour tee times: no confirmed API for this (the tee-times page
// is client-rendered same as everywhere else on this site, and it's
// unclear whether the real data comes from a plain REST call or the same
// hash-locked GraphQL system the shot feed turned out to use). Rather than
// spend more time chasing that down, this parses the visible table text
// directly - select the tee-time table on the page, copy, and paste the
// result here.
//
// The browser's actual copy behavior for this table puts every field on
// its own line, not one row per line - something like:
//   02:50
//   1
//   17
//   Flag for FRA
//   GUILLAMOUNDEGUY, Oihan
//   Flag for AUT
//   WIESBERGER, Bernd
//   Flag for ESP
//   AYORA, Angel
//   03:30
//   ...
// So this just scans line by line, tracking whichever time was most
// recently seen on its own line, and pairs every "Lastname, Firstname"
// line after that with it - "Flag for XXX" lines, bare tee/group numbers,
// and the header row are all silently skipped since none of them match
// either pattern.
//
// Times come through with no AM/PM marker on this site (24-hour-ish, but
// only ever showing early-morning hours once displayed in the viewer's
// local time) - assumed AM below to match what's actually been observed.
// If DP World Tour ever shows a PM group this way, that assumption would
// need revisiting.
export function parseDpwtTeeTimesText(raw: string): DpwtTeeTimeEntry[] {
  const entries: DpwtTeeTimeEntry[] = [];
  const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);

  const timeOnlyRe = /^(\d{1,2}):(\d{2})$/;
  const nameRe = /^([A-ZÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ'\-]+(?:\s[A-ZÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ'\-]+)*),\s*([A-ZÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ'\-]+(?:\s[A-Za-zÀ-ÖØ-öø-ÿ'\-]+)*)$/;

  let currentTime: string | null = null;
  for (const line of lines) {
    const timeMatch = line.match(timeOnlyRe);
    if (timeMatch) {
      let hour = parseInt(timeMatch[1], 10);
      if (hour === 0) hour = 12;
      currentTime = `${hour}:${timeMatch[2]} AM`;
      continue;
    }
    const nameMatch = line.match(nameRe);
    if (nameMatch && currentTime) {
      const [, lastName, firstName] = nameMatch;
      entries.push({ time: currentTime, playerName: `${firstName} ${lastName}` });
    }
  }

  return entries;
}
