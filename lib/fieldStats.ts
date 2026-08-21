import { redis, FIELD_STATS_KEY_PREFIX } from "./redis";
import { fetchPgaLeaderboard, fetchPlayerScorecardStats } from "./pgatour";
import { extractPlayers } from "./pgaMatch";
import { extractScorecardStats } from "./pgaScorecard";

// Fetches GIR/Fairways for the ENTIRE field - there's no single call that
// returns this for everyone at once (unlike position/score/thru), so this
// is one scorecard-stats call PER PLAYER, dozens to well over a hundred
// for a full field. That's why this now only runs once a day via a
// scheduled job (see app/api/cron/leaderboard-stats/route.ts) rather than
// being fetched live - this data doesn't change until the round is over
// anyway, so there's no benefit to fetching it more often, only cost.
const CONCURRENCY = 8;

export type PlayerRoundStats = {
  girCount: number | null;
  girTotal: number | null; // opportunities so far this round (18 once finished)
  fairwaysCount: number | null;
  fairwaysTotal: number | null; // opportunities so far this round (14 once finished, par-3s excluded)
};

export type FieldPlayerStats = {
  id: string;
  name: string;
  position: string | null;
  rounds: Record<string, PlayerRoundStats>; // keyed "1".."4"
  total: PlayerRoundStats;
};

export type FieldStatsCacheEntry = { fetchedAt: string; players: FieldPlayerStats[] };

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

function emptyRoundStats(): PlayerRoundStats {
  return { girCount: null, girTotal: null, fairwaysCount: null, fairwaysTotal: null };
}

export function fieldStatsCacheKey(tournamentId: string): string {
  return FIELD_STATS_KEY_PREFIX + tournamentId;
}

export async function fetchAndCacheFieldStats(tournamentId: string): Promise<FieldStatsCacheEntry> {
  const raw = await fetchPgaLeaderboard(tournamentId);
  const field = extractPlayers(raw);

  const players = await mapWithConcurrency(field, CONCURRENCY, async (p): Promise<FieldPlayerStats> => {
    const rounds: Record<string, PlayerRoundStats> = {};
    const total = emptyRoundStats();
    try {
      const statsJson = await fetchPlayerScorecardStats(tournamentId, p.id);
      for (let r = 1; r <= 4; r++) {
        const s = extractScorecardStats(statsJson, r);
        if (!s) continue;
        const roundStats: PlayerRoundStats = {
          girCount: s.girCount, girTotal: s.girThru,
          fairwaysCount: s.fairwaysCount, fairwaysTotal: s.fairwaysThru,
        };
        rounds[String(r)] = roundStats;
        if (roundStats.girCount !== null) total.girCount = (total.girCount ?? 0) + roundStats.girCount;
        if (roundStats.girTotal !== null) total.girTotal = (total.girTotal ?? 0) + roundStats.girTotal;
        if (roundStats.fairwaysCount !== null) total.fairwaysCount = (total.fairwaysCount ?? 0) + roundStats.fairwaysCount;
        if (roundStats.fairwaysTotal !== null) total.fairwaysTotal = (total.fairwaysTotal ?? 0) + roundStats.fairwaysTotal;
      }
    } catch {
      // One player's stats failing shouldn't blank out the whole field -
      // leave them with empty stats rather than erroring the whole run.
    }
    return { id: p.id, name: p.displayName, position: null, rounds, total };
  });

  const entry: FieldStatsCacheEntry = { fetchedAt: new Date().toISOString(), players };
  await redis.set(fieldStatsCacheKey(tournamentId), entry);
  return entry;
}
