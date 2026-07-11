import { NextResponse } from "next/server";
import { redis, BETS_KEY, MAPPING_KEY } from "../../../lib/redis";
import { Bet } from "../../../lib/seed";
import { Mapping } from "../../../lib/mapping";
import { fetchPgaLeaderboard } from "../../../lib/pgatour";
import { extractPlayers, findPlayerMatch, PgaPlayerRow } from "../../../lib/pgaMatch";
import { parseBetType } from "../../../lib/betLogic";

// Triggered by the browser (not a server cron - see README) roughly once a
// minute while the board is open. No passcode required: this route only
// recomputes values from the tournament mapping already saved server-side,
// it can't accept arbitrary bet data from the caller.
export async function GET() {
  const [bets, mapping] = await Promise.all([
    redis.get<Bet[]>(BETS_KEY),
    redis.get<Mapping>(MAPPING_KEY),
  ]);

  if (!bets || !mapping) {
    return NextResponse.json({ ok: true, updated: 0, errors: ["Nothing to sync yet"] });
  }

  const errors: string[] = [];
  const leaderboardCache = new Map<string, PgaPlayerRow[]>();
  let updatedCount = 0;

  for (const bet of bets) {
    if (bet.autoEnabled === false) continue;

    const tournamentMap = mapping.tournaments[bet.t];
    if (!tournamentMap?.pgaId) continue;

    try {
      let players = leaderboardCache.get(tournamentMap.pgaId);
      if (!players) {
        const raw = await fetchPgaLeaderboard(tournamentMap.pgaId);
        players = extractPlayers(raw);
        leaderboardCache.set(tournamentMap.pgaId, players);
      }

      const row = findPlayerMatch(bet.player, players);
      if (!row) {
        errors.push(`${bet.player}: no match on leaderboard`);
        continue;
      }

      const parsed = parseBetType(bet.bet);

      bet.thru = row.thru;
      bet.auto = {
        thru: row.thru,
        scoreToPar: row.score,
        birdies: null,
        bogeys: null,
        pars: null,
        eagles: null,
        doubleBogeys: null,
        gir: null,
        fairways: null,
        updatedAt: new Date().toISOString(),
      };

      // Only SCORE-type bets are computed automatically for now - GIR,
      // birdies, and bogeys need a second PGA Tour query we haven't wired
      // up yet.
      if (parsed.label === "SCORE" && row.score !== null) {
        bet.stat = row.score;
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
