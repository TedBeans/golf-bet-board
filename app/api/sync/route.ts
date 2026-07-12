import { NextResponse } from "next/server";
import { redis, BETS_KEY, MAPPING_KEY, SYNC_LOCK_KEY, ARCHIVE_KEY, PARLAYS_KEY, PARLAY_ARCHIVE_KEY } from "../../../lib/redis";
import { Bet } from "../../../lib/seed";
import { Mapping } from "../../../lib/mapping";
import { Parlay, resolveLegStatuses, deriveParlayStatus } from "../../../lib/parlay";
import { fetchPgaLeaderboard, fetchPlayerScorecardStats } from "../../../lib/pgatour";
import { extractPlayers, findPlayerMatch, findLeader, PgaPlayerRow } from "../../../lib/pgaMatch";
import { extractScorecardStats, roundNumberFromLabel } from "../../../lib/pgaScorecard";
import { parseBetType, autoGradeStatus, timeToMinutes } from "../../../lib/betLogic";
import { nowInCentral } from "../../../lib/centralTime";

const SYNC_LOCK_MS = 45000;

// Triggered by the browser (not a server cron - see README) roughly once a
// minute while the board is open. No passcode required: this route only
// recomputes values from the tournament mapping already saved server-side,
// it can't accept arbitrary bet data from the caller.
//
// Because every open tab triggers its own sync call, a friend group with
// many tabs open at once could otherwise multiply real PGA Tour requests.
// This lock collapses all of that into one shared fetch per ~45s window,
// regardless of how many people are watching.
export async function GET() {
  const now = Date.now();
  const lastSync = await redis.get<number>(SYNC_LOCK_KEY);
  if (lastSync && now - lastSync < SYNC_LOCK_MS) {
    return NextResponse.json({ ok: true, updated: 0, errors: [], skipped: true });
  }
  await redis.set(SYNC_LOCK_KEY, now);

  const [bets, mapping] = await Promise.all([
    redis.get<Bet[]>(BETS_KEY),
    redis.get<Mapping>(MAPPING_KEY),
  ]);

  if (!bets || !mapping) {
    return NextResponse.json({ ok: true, updated: 0, errors: ["Nothing to sync yet"] });
  }

  const errors: string[] = [];
  const leaderboardCache = new Map<string, PgaPlayerRow[]>();
  const scorecardCache = new Map<string, any>();
  let updatedCount = 0;
  const { dateStr: todayCentral, minutes: nowMinutes, dateTimeStr: nowCentralDT } = nowInCentral();

  // Auto-lift any suspension whose resume time has already passed, so both
  // the overlay and the fetch-blocking clear on their own.
  let mappingChanged = false;
  for (const key of Object.keys(mapping.tournaments)) {
    const tm = mapping.tournaments[key];
    if (tm.suspendedType && tm.suspendedType !== "none" && tm.suspendedUntil && nowCentralDT >= tm.suspendedUntil) {
      tm.suspendedType = "none";
      mappingChanged = true;
    }
  }
  if (mappingChanged) {
    await redis.set(MAPPING_KEY, mapping);
  }

  // Bets loaded before the recap feature existed have no loadedDate at all.
  // Backfill with today's Central date now, while they're still live, so
  // that whenever they do finish (even after midnight, like a suspended
  // round) they archive under the day they were actually played, not
  // whatever day happens to be current when they finally resolve.
  let loadedDateBackfilled = false;
  for (const bet of bets) {
    if (!bet.loadedDate) {
      bet.loadedDate = todayCentral;
      loadedDateBackfilled = true;
    }
  }

  for (const bet of bets) {
    if (bet.autoEnabled === false) continue;

    // Auto-promote TBD -> IN PROGRESS once its scheduled tee time (Central)
    // arrives - this is what actually opens the door to fetching for it.
    if (bet.status === "pending") {
      const teeMinutes = timeToMinutes(bet.time);
      const dateReached = !bet.loadedDate || todayCentral >= bet.loadedDate;
      if (dateReached && nowMinutes >= teeMinutes) {
        bet.status = "live";
        updatedCount += 1;
      }
    }

    if (bet.status === "hit" || bet.status === "miss") continue; // already decided - stop pulling for it
    if (bet.status === "pending") continue; // hasn't teed off yet - nothing to fetch

    const tournamentMap = mapping.tournaments[bet.t];
    if (!tournamentMap?.pgaId) continue;
    if (tournamentMap.suspendedType && tournamentMap.suspendedType !== "none") continue; // play stopped - nothing new to fetch
    const tournamentId = tournamentMap.pgaId;

    try {
      let players = leaderboardCache.get(tournamentId);
      if (!players) {
        const raw = await fetchPgaLeaderboard(tournamentId);
        players = extractPlayers(raw);
        leaderboardCache.set(tournamentId, players);
      }

      const parsed = parseBetType(bet.bet);

      // Tournament-long "winning score" bets track whoever is currently in
      // 1st place, not a specific named player - no scorecard fetch needed,
      // and never auto-graded (see autoGradeStatus), so this just updates
      // the live number for you to eyeball and settle by hand.
      if (parsed.label === "WINNER_SCORE") {
        const leader = findLeader(players);
        if (!leader) {
          errors.push(`${bet.t}: couldn't find a tournament leader`);
          continue;
        }
        bet.thru = leader.thru;
        bet.stat = leader.total;
        bet.auto = {
          thru: leader.thru,
          scoreToPar: leader.total,
          birdies: null,
          bogeys: null,
          pars: null,
          eagles: null,
          doubleBogeys: null,
          gir: null,
          fairways: null,
          updatedAt: new Date().toISOString(),
          leaderName: leader.displayName,
        };
        updatedCount += 1;
        continue;
      }

      const row = findPlayerMatch(bet.player, players);
      if (!row) {
        errors.push(`${bet.player}: no match on leaderboard`);
        continue;
      }

      const roundNum = roundNumberFromLabel(bet.r);
      const scorecardKey = `${tournamentId}:${row.id}`;
      let scorecardJson = scorecardCache.get(scorecardKey);
      if (scorecardJson === undefined) {
        try {
          scorecardJson = await fetchPlayerScorecardStats(tournamentId, row.id);
        } catch {
          scorecardJson = null; // don't let a scorecard failure block the score-only bets
        }
        scorecardCache.set(scorecardKey, scorecardJson);
      }
      const scorecard = scorecardJson ? extractScorecardStats(scorecardJson, roundNum) : null;

      bet.thru = row.thru;
      bet.auto = {
        thru: row.thru,
        scoreToPar: row.score,
        birdies: scorecard?.birdies ?? null,
        bogeys: scorecard?.bogeys ?? null,
        pars: scorecard?.pars ?? null,
        eagles: null,
        doubleBogeys: null,
        gir: scorecard?.gir ?? null,
        fairways: scorecard?.fairways ?? null,
        updatedAt: new Date().toISOString(),
      };

      if (parsed.label === "SCORE" && row.score !== null) {
        bet.stat = row.score;
      } else if (parsed.label === "GIR" && scorecard?.girCount !== null && scorecard?.girCount !== undefined) {
        bet.stat = scorecard.girCount;
      } else if (parsed.label === "BIRDIES" && scorecard?.birdies !== null && scorecard?.birdies !== undefined) {
        bet.stat = scorecard.birdies;
      } else if (parsed.label === "BOGEYS" && scorecard?.bogeys !== null && scorecard?.bogeys !== undefined) {
        bet.stat = scorecard.bogeys;
      } else if (parsed.label === "PARS" && scorecard?.pars !== null && scorecard?.pars !== undefined) {
        bet.stat = scorecard.pars;
      }

      // Only progress a bet forward automatically while it's still live -
      // never overwrite a status you set by hand. (Pending bets already
      // got skipped above, before they ever reach here.)
      if (bet.status === "live") {
        const graded = autoGradeStatus(parsed, bet.stat, bet.thru);
        if (graded) bet.status = graded;
      }

      updatedCount += 1;
    } catch (e: any) {
      errors.push(`${bet.player}: ${e.message || "sync failed"}`);
    }
  }

  // Once every bet in a tournament+round is decided (win or loss), file the
  // whole round away to the recap automatically - a bet stays on the live
  // board as long as anything in its round is still pending/live, even if
  // that means it sits alongside a newer round's bets for a day or two.
  const groupMap: Record<string, Bet[]> = {};
  for (const b of bets) {
    const key = `${b.t}|||${b.r}`;
    (groupMap[key] = groupMap[key] || []).push(b);
  }
  const remaining: Bet[] = [];
  const toArchive: Bet[] = [];
  const archivedAt = new Date().toISOString();
  for (const key of Object.keys(groupMap)) {
    const groupBets = groupMap[key];
    const allDecided = groupBets.every((b) => b.status === "hit" || b.status === "miss");
    if (allDecided) {
      groupBets.forEach((b) => toArchive.push({ ...b, archivedAt }));
    } else {
      remaining.push(...groupBets);
    }
  }

  let finalBets = bets;
  let archivedCount = 0;
  if (toArchive.length > 0) {
    const existingArchive = (await redis.get<Bet[]>(ARCHIVE_KEY)) || [];
    await redis.set(ARCHIVE_KEY, [...existingArchive, ...toArchive]);
    finalBets = remaining;
    archivedCount = toArchive.length;
  }

  if (updatedCount > 0 || archivedCount > 0 || loadedDateBackfilled) {
    await redis.set(BETS_KEY, finalBets);
  }

  // Parlays never fetch anything themselves - just re-check each leg
  // against the live bets (post-sync) and the bet archive (which may have
  // just grown above), then file away any parlay that's now fully decided.
  const liveParlays = (await redis.get<Parlay[]>(PARLAYS_KEY)) || [];
  if (liveParlays.length > 0) {
    const archiveForLegs = (await redis.get<Bet[]>(ARCHIVE_KEY)) || [];

    const stillOpen: Parlay[] = [];
    const nowDecided: Parlay[] = [];
    for (const p of liveParlays) {
      const legStatuses = resolveLegStatuses(p.legs, finalBets, archiveForLegs);
      p.status = deriveParlayStatus(legStatuses);
      if (p.status === "hit" || p.status === "miss") {
        nowDecided.push({ ...p, archivedAt: new Date().toISOString() });
      } else {
        stillOpen.push(p);
      }
    }
    if (nowDecided.length > 0) {
      const existingParlayArchive = (await redis.get<Parlay[]>(PARLAY_ARCHIVE_KEY)) || [];
      await redis.set(PARLAY_ARCHIVE_KEY, [...existingParlayArchive, ...nowDecided]);
    }
    await redis.set(PARLAYS_KEY, stillOpen);
  }

  return NextResponse.json({ ok: true, updated: updatedCount, archived: archivedCount, errors });
}
