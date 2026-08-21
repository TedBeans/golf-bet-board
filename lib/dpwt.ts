// DP World Tour (europeantour.com) integration.
//
// STATUS: not live-graded right now. Every bet type on this tour is
// manual (WIN/LOSS buttons on the board), same as it always was for
// Fairways/GIR/Tournament Score - see below for why.
//
// HISTORY, for whoever revisits this later:
//
// The site's live GraphQL feed (getGolfTournamentGroupScores) looked
// promising for a single call covering the whole field, but the real
// captured request URL turned out to be
// "https://btec-http.services.srarena.io/?hash=3957876929" - a numeric
// hash of the query+variables computed client-side by their JS, not a
// stable parameterized endpoint. Couldn't reconstruct that hash for a
// different tournament/round/group without reverse-engineering their
// hashing function.
//
// Found what looked like a clean fallback instead - a plain REST GET with
// no hash and (apparently) no auth:
//
//   https://www.europeantour.com/api/sportdata/Scorecard/Strokeplay/Event/{eventId}/Player/{playerId}
//
// Worked fine from a browser. From this app's server, it 403'd. Adding a
// Referer header (matching the pattern that already worked for PGA Tour
// and theopen.com in this codebase) didn't fix it. Adding a full
// browser-realistic header set (User-Agent, Accept-Language, Referer)
// didn't fix it either. Confirmed with a direct curl test using that
// exact header set from outside this app entirely - still blocked, and
// the response body gave the real answer: "Access Denied" served from
// errors.edgesuite.net, which is Akamai's own domain. This endpoint sits
// behind Akamai Bot Manager, which fingerprints things like the TLS
// handshake itself - a layer no HTTP header can influence. A scripted
// client (this app's fetch(), or curl) fundamentally can't pass that the
// way a real browser does, no matter what headers it sends.
//
// So there's no clean path to live grading for this tour right now short
// of running an actual headless browser (Puppeteer/Playwright) somewhere,
// or paying for a bot-bypass proxy service - neither of which is
// reasonable for this app. The functions below (fetchDpwtPlayerScorecard,
// summarizeDpwtRound, findDpwtRound, parseDpwtRosterCapture) are kept
// working and tested against real captured data, in case a workaround
// becomes worth it later - they're just not called from sync/route.ts
// right now.
//
// The tee-time paste tool (parseDpwtTeeTimesText) is unaffected by any of
// this - it was already manual/paste-based from the start, not something
// this Akamai block touches.

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

// Confirmed via DevTools capture - plain GET, no auth. Getting a 403 on a
// bare fetch() from a server even though the same URL works fine from a
// browser - a Referer header alone wasn't enough to clear it, so this
// also sends a realistic browser User-Agent and Accept-Language, in case
// whatever's fronting this endpoint is blocking on the request not
// looking browser-like at all (common with Akamai/similar bot protection,
// which the domain naming elsewhere on this site suggests is in play).
export async function fetchDpwtPlayerScorecard(eventId: string, playerId: number): Promise<DpwtScorecardResponse> {
  const url = `https://www.europeantour.com/api/sportdata/Scorecard/Strokeplay/Event/${eventId}/Player/${playerId}`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "Accept-Language": "en-US,en;q=0.9",
      Referer: "https://www.europeantour.com/",
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
    },
    cache: "no-store",
  });
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
// The site displays times in 24-hour format throughout (confirmed
// elsewhere in the app - e.g. a live clock widget showing "04:40", not
// "4:40 AM"), so this converts properly instead of assuming every time is
// AM. An earlier version of this function did assume AM unconditionally,
// which happened to work for the one tournament it was first tested
// against (every tee time that day was genuinely before noon) but would
// have silently mis-logged any 12:xx-and-later time as after-midnight AM
// instead of the early-afternoon PM it actually was - caught when a
// second tournament's tee times spanned into the 12:xx range.
export function parseDpwtTeeTimesText(raw: string): DpwtTeeTimeEntry[] {
  const entries: DpwtTeeTimeEntry[] = [];
  const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);

  const timeOnlyRe = /^(\d{1,2}):(\d{2})$/;
  const nameRe = /^([A-ZÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ'\-]+(?:\s[A-ZÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ'\-]+)*),\s*([A-ZÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ'\-]+(?:\s[A-Za-zÀ-ÖØ-öø-ÿ'\-]+)*)$/;

  let currentTime: string | null = null;
  for (const line of lines) {
    const timeMatch = line.match(timeOnlyRe);
    if (timeMatch) {
      const hour24 = parseInt(timeMatch[1], 10);
      const period = hour24 < 12 ? "AM" : "PM";
      let hour12 = hour24 % 12;
      if (hour12 === 0) hour12 = 12;
      currentTime = `${hour12}:${timeMatch[2]} ${period}`;
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
