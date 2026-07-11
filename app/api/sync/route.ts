import { NextResponse } from "next/server";
import { redis, BETS_KEY, MAPPING_KEY } from "../../../lib/redis";
import { Bet } from "../../../lib/seed";
import { Mapping, EMPTY_MAPPING } from "../../../lib/mapping";
import { fetchPlayerSummary } from "../../../lib/espn";
import { computeRoundStats, roundNumberFromLabel } from "../../../lib/statCompute";
import { parseBetType, autoStatValue } from "../../../lib/betLogic";

// Triggered by the browser (not a server cron - see README) roughly once a
// minute while the board is open. No passcode required: this route can only
// recompute values from the mapping already saved server-side, it can't
// accept arbitrary bet data from the caller.
export async function GET() {
  const [bets, mapping] = await Promise.all([
    redis.get<Bet[]>(BETS_KEY),
    redis.get<Mapping>(MAPPING_KEY),
  ]);

  if (!bets || !mapping) {
    return NextResponse.json({ ok: true, updated: 0, errors: ["Nothing to sync yet"] });
  }

  const season = new Date().getFullYear();
  const errors: string[] = [];
  const cache = new Map<string, any>(); // key: eventId:playerId -> playersummary json
  let updatedCount = 0;

  for (const bet of bets) {
    if (bet.autoEnabled === false) continue;

    const tournamentMap = mapping.tournaments[bet.t];
    const playerMap = mapping.players[bet.player];
    if (!tournamentMap?.eventId || !playerMap?.espnId) continue;

    const cacheKey = `${tournamentMap.eventId}:${playerMap.espnId}`;
    try {
      let summary = cache.get(cacheKey);
      if (!summary) {
        summary = await fetchPlayerSummary(tournamentMap.eventId, playerMap.espnId, season);
        cache.set(cacheKey, summary);
      }
      const roundNum = roundNumberFromLabel(bet.r);
      const auto = computeRoundStats(summary, roundNum);
      if (!auto) continue;

      const parsed = parseBetType(bet.bet);
      const value = autoStatValue(parsed, auto);

      bet.auto = auto;
      bet.thru = auto.thru;
      if (value !== null) bet.stat = value;
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
