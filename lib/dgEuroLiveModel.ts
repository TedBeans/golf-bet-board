import { unescapeJsStringLiteral } from "./datagolf";
import { normalizeName } from "./nameNorm";

// datagolf.com hosts a DP World Tour equivalent of the PGA Tour live-model
// page already scraped in lib/datagolf.ts - same site, same embedded-JSON-
// blob technique (see that file's header comment for the full mechanics),
// just a different tour parameter and a noticeably richer blob for this
// tour: it carries not just position/score, but every player's hole-by-
// hole strokes for every round played (player_scores) and each hole's par
// (scorecard) - the WHOLE FIELD, not one player at a time. This is what
// finally unlocks Winner/Top N/Make Cut/H2H/Tie/R1 Leader/Lowest Round for
// DP World Tour, none of which were possible via europeantour.com's own
// API (Akamai-blocked server-side - see lib/dpwt.ts). It also derives
// Score/Birdies/Bogeys/Pars/Eagles for regular round-scoped bets, which
// were fully manual before this.
//
// Deliberately NOT reusing this blob's own "today" field for a round's
// score-to-par - a real capture (Husqvarna British Masters, 2026-08-28)
// showed "today": 0 identically for every single player regardless of
// their actual score, including one whose hole-by-hole strokes summed by
// hand to a clear -6 matching their reported cumulative total exactly.
// That field appears to only get correctly populated by the page's own
// live AJAX poller, not present in a single static fetch of the page.
// Computing everything directly from hole-by-hole strokes minus each
// hole's par sidesteps that entirely - verified against real data below.
const DG_EURO_URL = "https://datagolf.com/live-model/european-tour";

export type DgEuroPlayerRow = {
  dgId: string;
  playerNum: string; // key into playerScores/scorecard below - NOT the same as dgId
  rawName: string; // "Last, First"
  displayName: string; // "First Last"
  lastName: string;
  currentPos: string | null;
  currentScore: number | null; // cumulative total to par - verified reliable against hand-summed hole-by-hole data
  thru: number | string | null; // current round holes completed ("F" once finished)
  today: number | null; // this round's score to par, per DataGolf's own "Today" column
  teetime: string | null; // bare "H:MM" local tournament time, no AM/PM marker - see convertDgEuroTeeTime
  round: number | null; // which round current_pos/current_score/thru refer to
  courseCode: string | null;
  cutProb: number | null; // 0-100, 1dp - DataGolf's own live make-cut probability, informational only like the PGA Tour equivalent
};

export type DgEuroRoundStats = {
  scoreToPar: number;
  thru: number; // holes with a recorded strokes value this round
  birdies: number;
  bogeys: number;
  pars: number;
  eagles: number; // eagle or better
  doubleBogeys: number; // double bogey or worse
};

export type DgEuroLiveModel = {
  players: DgEuroPlayerRow[];
  currentRound: number | null; // others.max_round - the tour-wide current round, given directly rather than inferred
  eventName: string | null;
  eventFlag: string | null; // others.event_flag - 3-letter host-country code, used to look up the tournament's local timezone (see DPWT_COUNTRY_TIMEZONES)
  playerScores: any; // kept raw - shape is {[playerNum]: {[round]: {"1".."18": strokes|null, course_code, ...}}}
  scorecard: any; // kept raw - shape is {[courseCode]: {"1".."18": {par, yardage, ...}}}
};

function looksLikeMainRow(row: any): boolean {
  return row && typeof row === "object" && "dg_id" in row && "name" in row && "player_num" in row && "current_pos" in row;
}

// Returns the whole parsed response object once the `main` array (the
// per-player field data) is found inside it, so every other known-name
// sibling key (player_scores, scorecard, others) can be read directly off
// the same confirmed object rather than guessed at via another generic
// structural search - safe once we know this IS the right blob.
function findMainBlob(node: any, depth = 0): any | null {
  if (depth > 4 || node === null || node === undefined || typeof node !== "object" || Array.isArray(node)) return null;
  if (Array.isArray(node.main) && node.main.length > 0 && looksLikeMainRow(node.main[0])) return node;
  for (const key of Object.keys(node)) {
    const found = findMainBlob(node[key], depth + 1);
    if (found) return found;
  }
  return null;
}

function toDisplayName(rawName: string): { displayName: string; lastName: string } {
  const parts = rawName.split(",");
  if (parts.length >= 2) {
    const last = parts[0].trim();
    const first = parts.slice(1).join(",").trim();
    return { displayName: `${first} ${last}`.trim(), lastName: last };
  }
  return { displayName: rawName.trim(), lastName: rawName.trim() };
}

export function extractDgEuroBlob(html: string): DgEuroLiveModel {
  const blobRegex = /JSON\.parse\('((?:\\.|[^'\\])*)'/g;
  let m: RegExpExecArray | null;
  while ((m = blobRegex.exec(html)) !== null) {
    try {
      const jsonText = unescapeJsStringLiteral(m[1]).replace(/\bNaN\b/g, "null");
      const parsed = JSON.parse(jsonText);
      const found = findMainBlob(parsed);
      if (!found) continue;

      const players: DgEuroPlayerRow[] = found.main.map((r: any) => {
        const { displayName, lastName } = toDisplayName(String(r.name || ""));
        return {
          dgId: r.dg_id != null ? String(r.dg_id) : "",
          playerNum: r.player_num != null ? String(r.player_num) : "",
          rawName: String(r.name || ""),
          displayName,
          lastName,
          currentPos: r.current_pos != null ? String(r.current_pos) : null,
          currentScore: typeof r.current_score === "number" ? r.current_score : null,
          thru: r.thru ?? null,
          today: typeof r.today === "number" ? r.today : null,
          teetime: typeof r.teetime === "string" ? r.teetime : null,
          round: typeof r.round === "number" ? r.round : null,
          courseCode: r.course ?? null,
          cutProb: typeof r.cut === "number" && !isNaN(r.cut) ? Math.round(r.cut * 1000) / 10 : null,
        };
      });

      const maxRoundRaw = found.others?.max_round;
      const currentRound = maxRoundRaw != null ? parseInt(String(maxRoundRaw), 10) : null;
      const eventName = found.others?.event_name?.[0]?.event_name ?? null;
      const eventFlag = typeof found.others?.event_flag === "string" ? found.others.event_flag : null;

      return {
        players,
        currentRound: currentRound !== null && !isNaN(currentRound) ? currentRound : null,
        eventName,
        eventFlag,
        playerScores: found.player_scores ?? {},
        scorecard: found.scorecard ?? {},
      };
    } catch {
      // not the blob we want, or malformed - keep scanning
    }
  }
  throw new Error("Could not locate DP World Tour live-model data in page HTML - page structure may have changed");
}

export async function fetchDgEuroLiveModel(): Promise<DgEuroLiveModel> {
  const res = await fetch(DG_EURO_URL, {
    method: "GET",
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml",
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`datagolf.com (DP World Tour) fetch failed (${res.status})`);
  const html = await res.text();
  return extractDgEuroBlob(html);
}

// Derives everything about ONE player's ONE round directly from hole-by-
// hole strokes vs that hole's par (see the module header comment for why
// this is used instead of the blob's own "today" field). Returns null if
// this player/round combination has no recorded holes at all yet.
export function computeDgEuroRoundStats(model: DgEuroLiveModel, playerNum: string, roundNum: number): DgEuroRoundStats | null {
  const playerRounds = model.playerScores?.[playerNum];
  if (!playerRounds) return null;
  const round = playerRounds[String(roundNum)];
  if (!round) return null;
  const courseCode = round.course_code;
  const courseHoles = model.scorecard?.[courseCode];
  if (!courseHoles) return null;

  let scoreToPar = 0;
  let thru = 0;
  let birdies = 0, bogeys = 0, pars = 0, eagles = 0, doubleBogeys = 0;

  for (let hole = 1; hole <= 18; hole++) {
    const strokes = round[String(hole)];
    if (strokes === null || strokes === undefined || typeof strokes !== "number") continue;
    const parRaw = courseHoles[String(hole)]?.par;
    const par = parRaw !== undefined ? parseInt(String(parRaw), 10) : NaN;
    if (isNaN(par)) continue;

    const diff = strokes - par;
    scoreToPar += diff;
    thru += 1;
    if (diff <= -2) eagles += 1;
    else if (diff === -1) birdies += 1;
    else if (diff === 0) pars += 1;
    else if (diff === 1) bogeys += 1;
    else doubleBogeys += 1;
  }

  if (thru === 0) return null;
  return { scoreToPar, thru, birdies, bogeys, pars, eagles, doubleBogeys };
}

// Field leader by cumulative total-to-par (self-computed, same reasoning
// as computeDgEuroTotalToPar) - used for tournament-long "winning score"
// bets, mirroring findLeader/findOpenLeader's role for the other tours.
export function findDgEuroLeader(model: DgEuroLiveModel): { player: DgEuroPlayerRow; totalToPar: number } | null {
  let best: { player: DgEuroPlayerRow; totalToPar: number } | null = null;
  for (const p of model.players) {
    const total = computeDgEuroTotalToPar(model, p.playerNum);
    if (total === null) continue;
    if (best === null || total < best.totalToPar) best = { player: p, totalToPar: total };
  }
  return best;
}

// A single hole's outcome for a specific player/round - thru is 0 (not
// played) or 1 (played), diff is score-to-par for that one hole. Matches
// computeHoleScore's contract in lib/pgaScorecard.ts.
export function computeDgEuroHoleScore(model: DgEuroLiveModel, playerNum: string, roundNum: number, holeNumber: number): { thru: 0 | 1; diff: number | null } {
  const playerRounds = model.playerScores?.[playerNum];
  const round = playerRounds?.[String(roundNum)];
  if (!round) return { thru: 0, diff: null };
  const strokes = round[String(holeNumber)];
  if (strokes === null || strokes === undefined || typeof strokes !== "number") return { thru: 0, diff: null };
  const courseCode = round.course_code;
  const parRaw = model.scorecard?.[courseCode]?.[String(holeNumber)]?.par;
  const par = parRaw !== undefined ? parseInt(String(parRaw), 10) : NaN;
  if (isNaN(par)) return { thru: 0, diff: null };
  return { thru: 1, diff: strokes - par };
}

export type DgEuroCurrentRoundStat = {
  scoreToPar: number | null;
  thru: number | null;
  birdies: number | null;
  bogeys: number | null;
  pars: number | null;
  eagles: number | null;
  doubleBogeys: number | null;
  fromHoleData: boolean; // false when this came from the fallback below, not real hole-by-hole detail
};

// computeDgEuroRoundStats requires hole-by-hole detail to exist for the
// round in question - but a real case showed that data lagging behind
// the tour's own faster-updating leaderboard summary fields during live
// play (a player already 2 holes into their round per current_pos/thru,
// with nothing yet in player_scores for that round). This only matters
// for whichever round is CURRENTLY being played tour-wide (model.currentRound) -
// a genuinely past round missing hole data would be a different, real
// problem, not a timing lag, so this deliberately only falls back for
// the live round, never a historical one.
//
// The fallback trusts the blob's own "today" field directly - exactly
// what DataGolf's own UI shows as the round's score, so it matches what
// a human comparing against the live site sees. An earlier version of
// this fallback tried to derive the score by subtracting every earlier
// round's hole-by-hole total from the cumulative current_score instead,
// on the assumption that player_scores retains full tournament history -
// a real case proved that assumption false (by round 4, rounds 1-3 had
// no hole data left in player_scores at all, silently zeroing out the
// subtraction and leaving the full cumulative -17 total misattributed to
// a single round). "today" is only trusted once the player has actually
// started this round (thru > 0 per the leaderboard's own thru field) -
// an earlier, separate capture found "today" stuck at 0 for every player
// during a different tournament's very first round, indistinguishable
// from "hasn't teed off" without that check.
export function getDgEuroCurrentRoundStat(model: DgEuroLiveModel, mainRow: DgEuroPlayerRow, roundNum: number): DgEuroCurrentRoundStat {
  const holeStats = computeDgEuroRoundStats(model, mainRow.playerNum, roundNum);
  if (holeStats) {
    return {
      scoreToPar: holeStats.scoreToPar, thru: holeStats.thru,
      birdies: holeStats.birdies, bogeys: holeStats.bogeys, pars: holeStats.pars,
      eagles: holeStats.eagles, doubleBogeys: holeStats.doubleBogeys, fromHoleData: true,
    };
  }

  const empty: DgEuroCurrentRoundStat = { scoreToPar: null, thru: null, birdies: null, bogeys: null, pars: null, eagles: null, doubleBogeys: null, fromHoleData: false };
  if (roundNum !== model.currentRound) return empty;

  const thru = typeof mainRow.thru === "number" ? mainRow.thru : mainRow.thru === "F" ? 18 : null;
  if (!thru || thru <= 0 || mainRow.today === null) return empty;
  return { ...empty, scoreToPar: mainRow.today, thru };
}

// Every round (1-4) this player has any recorded holes for, per the
// player_scores blob directly - used by Lowest Round tracking, which
// (unlike PGA Tour's equivalent in lib/roundScores.ts) doesn't need its
// own persisted history, since this blob already retains full hole-by-
// hole detail for every round played so far, not just the current one.
export function dgEuroRoundsPlayed(model: DgEuroLiveModel, playerNum: string): number[] {
  const playerRounds = model.playerScores?.[playerNum];
  if (!playerRounds) return [];
  return Object.keys(playerRounds)
    .filter((k) => /^\d+$/.test(k))
    .map((k) => parseInt(k, 10))
    .sort((a, b) => a - b);
}

// Cumulative total-to-par computed by summing this module's own hole-by-
// hole round stats across every round played, rather than trusting the
// blob's own current_score field directly. Justified by a real, verified
// discrepancy: cross-checking a finished player's round (thru "F") found
// their hole-by-hole sum matched current_score exactly, but a mid-round
// player (thru 16 of 18) showed a genuine 1-stroke gap between the two -
// the hole-by-hole data likely updates on a different cycle than the
// summary field mid-round. Standings-sensitive bet types (Winner, Top N,
// H2H, Tie, R1 Leader) use this instead, so every player's total is
// derived the same consistent way rather than mixing sources. Returns
// null if this player has no recorded holes for any round yet.
export function computeDgEuroTotalToPar(model: DgEuroLiveModel, playerNum: string): number | null {
  const rounds = dgEuroRoundsPlayed(model, playerNum);
  if (rounds.length === 0) return null;
  let total = 0;
  let any = false;
  for (const r of rounds) {
    const stats = computeDgEuroRoundStats(model, playerNum, r);
    if (stats) {
      total += stats.scoreToPar;
      any = true;
    }
  }
  return any ? total : null;
}

// Holes completed in whichever round is currently in progress for this
// player (the highest round with any recorded holes) - used alongside
// computeDgEuroTotalToPar for a self-consistent "thru" that matches the
// same hole-by-hole source, rather than the blob's own thru field.
export function dgEuroCurrentThru(model: DgEuroLiveModel, playerNum: string): number | null {
  const rounds = dgEuroRoundsPlayed(model, playerNum);
  if (rounds.length === 0) return null;
  const latestRound = rounds[rounds.length - 1];
  const stats = computeDgEuroRoundStats(model, playerNum, latestRound);
  return stats ? stats.thru : null;
}

// Same tiered fuzzy match (exact, last-name-only, prefix, substring,
// token-set) as every other player matcher in this app.
export function findDgEuroPlayerMatch(betPlayerName: string, players: DgEuroPlayerRow[]): DgEuroPlayerRow | null {
  const norm = (s: string) => normalizeName(s).toLowerCase();
  const target = norm(betPlayerName);
  const tokens = target.split(/\s+/).filter(Boolean);
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
  if (match) return match;

  const candidates = players.filter((p) => {
    const pTokens = norm(p.displayName).split(/\s+/).filter(Boolean);
    if (pTokens.length === 0) return false;
    return tokens.every((t) => pTokens.includes(t)) || pTokens.every((pt) => tokens.includes(pt));
  });
  if (candidates.length === 1) return candidates[0];

  return null;
}

// --- Tee time conversion -----------------------------------------------
// DataGolf gives tee times as a bare "H:MM" string in the tournament's own
// local time, with no AM/PM marker and no date attached (unlike PGA
// Tour's own tee-time feed, which gives an absolute UTC timestamp directly
// - see the existing PGA tee-time auto-fill in app/api/sync/route.ts).
// Two things have to be inferred here that PGA Tour's feed doesn't require:

// 1) AM vs PM. Real tee times only ever fall within a normal single-wave
// window (roughly 6am-4pm local) - never genuinely ambiguous within that
// range. Cross-validated against a real case: Shane Lowry's own round-4
// tee time showed as bare "2:05" in the raw blob, but DataGolf's own UI
// labeled it "2:05 PM" - and checked against the device clock plus his
// actual holes-played progress at the time, an 8:05 AM Central start
// (2:05 PM Irish minus the 6-hour Ireland-Central gap in effect that
// week) lined up exactly with how many holes he'd played. Hour 7-11 is
// AM, hour 12 or 1-6 is PM.
function inferAmPm(hour12: number): "AM" | "PM" {
  return hour12 >= 7 && hour12 <= 11 ? "AM" : "PM";
}

function to24Hour(hour12: number, period: "AM" | "PM"): number {
  if (period === "AM") return hour12 === 12 ? 0 : hour12;
  return hour12 === 12 ? 12 : hour12 + 12;
}

// 2) Which timezone "local" even means. DataGolf gives the host country's
// 3-letter flag code (others.event_flag) but not a timezone directly, so
// this maps the countries actually encountered so far to an IANA zone.
// This is NOT an exhaustive map of every country DP World Tour visits
// across a season (20+ countries spanning Europe, Africa, the Middle
// East, and Asia) - an unmapped country fails loudly (no auto-fill,
// nothing silently guessed) rather than defaulting somewhere that might
// be wrong. Add to this list as new host countries come up.
const DPWT_COUNTRY_TIMEZONES: Record<string, string> = {
  IRL: "Europe/Dublin",
  ENG: "Europe/London",
  SCO: "Europe/London",
  WAL: "Europe/London",
  NIR: "Europe/London",
  ESP: "Europe/Madrid",
  FRA: "Europe/Paris",
  ITA: "Europe/Rome",
  GER: "Europe/Berlin",
  NED: "Europe/Amsterdam",
  POR: "Europe/Lisbon",
  RSA: "Africa/Johannesburg",
  UAE: "Asia/Dubai",
  QAT: "Asia/Qatar",
  KSA: "Asia/Riyadh",
  AUS: "Australia/Sydney",
};

// How far ahead of UTC (in minutes) the given IANA timezone is, AT the
// given instant - computed from the actual current DST state via
// Intl.DateTimeFormat rather than a hardcoded offset, so this stays
// correct across DST transitions in either country without needing
// updates twice a year.
function getUtcOffsetMinutes(timeZone: string, atDate: Date): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone, hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const parts = dtf.formatToParts(atDate);
  const map: Record<string, string> = {};
  for (const p of parts) map[p.type] = p.value;
  const asIfUtc = Date.UTC(+map.year, +map.month - 1, +map.day, +map.hour, +map.minute, +map.second);
  return (asIfUtc - atDate.getTime()) / 60000;
}

// Converts a wall-clock time (today's date, in sourceTimeZone) to its
// Central-time equivalent, DST-aware in both directions.
function convertLocalTimeToCentral(hour24: number, minute: number, sourceTimeZone: string, referenceDate: Date = new Date()): string {
  const dateParts = new Intl.DateTimeFormat("en-US", { timeZone: sourceTimeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(referenceDate);
  const map: Record<string, string> = {};
  for (const p of dateParts) map[p.type] = p.value;
  const naiveUtcMs = Date.UTC(+map.year, +map.month - 1, +map.day, hour24, minute, 0);
  const offsetMin = getUtcOffsetMinutes(sourceTimeZone, new Date(naiveUtcMs));
  const trueInstant = new Date(naiveUtcMs - offsetMin * 60000);
  return new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", hour: "numeric", minute: "2-digit", hour12: true }).format(trueInstant);
}

// Converts a DataGolf bare "H:MM" tee time (in the tournament's own local
// time) to a Central-time "H:MM AM/PM" string, or null if the event's
// host country isn't in DPWT_COUNTRY_TIMEZONES or the string doesn't
// parse - never a silent wrong guess.
export function convertDgEuroTeeTime(teetime: string, eventFlag: string | null): string | null {
  if (!eventFlag) return null;
  const timeZone = DPWT_COUNTRY_TIMEZONES[eventFlag.toUpperCase()];
  if (!timeZone) return null;

  const m = teetime.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const hour12 = parseInt(m[1], 10);
  const minute = parseInt(m[2], 10);
  if (hour12 < 1 || hour12 > 12 || minute < 0 || minute > 59) return null;

  const period = inferAmPm(hour12);
  const hour24 = to24Hour(hour12, period);
  return convertLocalTimeToCentral(hour24, minute, timeZone);
}
