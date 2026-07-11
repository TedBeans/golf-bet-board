import { NextResponse } from "next/server";
import { redis, BETS_KEY, MAPPING_KEY, SYNC_LOCK_KEY } from "../../../lib/redis";
import { Bet } from "../../../lib/seed";
import { Mapping } from "../../../lib/mapping";
import { fetchPgaLeaderboard, fetchPlayerScorecardStats } from "../../../lib/pgatour";
import { extractPlayers, findPlayerMatch, PgaPlayerRow } from "../../../lib/pgaMatch";
import { extractScorecardStats, roundNumberFromLabel } from "../../../lib/pgaScorecard";
import { parseBetType } from "../../../lib/betLogic";

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

  for (const bet of bets) {
    if (bet.autoEnabled === false) continue;

    const tournamentMap = mapping.tournaments[bet.t];
    if (!tournamentMap?.pgaId) continue;
    const tournamentId = tournamentMap.pgaId;

    try {
      let players = leaderboardCache.get(tournamentId);
      if (!players) {
        const raw = await fetchPgaLeaderboard(tournamentId);
        players = extractPlayers(raw);
        leaderboardCache.set(tournamentId, players);
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

      const parsed = parseBetType(bet.bet);

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
      }

      updatedCount += 1;
    } catch (e: any) {
      errors.push(`${bet.player}: ${e.message || "sync failed"}`);
    }
  }

  if (updatedCount > 0) {
    await redis.set(BETS_KEY, bets);
  }

  return NextResponse.json({ ok: true, updated: updatedCount, errors });
}
