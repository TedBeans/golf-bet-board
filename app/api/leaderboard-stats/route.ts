import { NextRequest } from "next/server";
import { redis, MAPPING_KEY, FIELD_STATS_KEY_PREFIX } from "../../../lib/redis";
import { Mapping } from "../../../lib/mapping";
import { fetchPgaLeaderboard, fetchPlayerScorecardStats } from "../../../lib/pgatour";
import { extractPlayers } from "../../../lib/pgaMatch";
import { extractScorecardStats } from "../../../lib/pgaScorecard";
import { noCacheJson } from "../../../lib/noCacheJson";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

// This route fetches one scorecard-stats call PER PLAYER in the field
// (there's no single call that returns GIR/Fairways for everyone at
// once, unlike position/score/thru) - for a full field that's dozens to
// well over a hundred calls, a genuinely different order of magnitude
// than anything else this app does. Cache the result for a few minutes
// so repeated client polls (and multiple people with the board open)
// don't each re-trigger a full-field refetch - this data doesn't need
// live-score freshness the way position does.
const CACHE_TTL_MS = 3 * 60 * 1000;
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

type CacheEntry = { fetchedAt: string; players: FieldPlayerStats[] };

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

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tournament = searchParams.get("tournament");
  const forceRefresh = searchParams.get("refresh") === "1";
  if (!tournament) {
    return noCacheJson({ error: "Missing tournament" }, { status: 400 });
  }

  const mapping = (await redis.get<Mapping>(MAPPING_KEY)) || { tournaments: {} };
  const tournamentMap = mapping.tournaments[tournament];

  if (tournamentMap?.dataSource === "theopen" || tournamentMap?.dataSource === "dpwt") {
    return noCacheJson({
      error: "Greens/Fairways field stats aren't available for this tour yet - only PGA Tour tournaments have a per-player stats source this app can use.",
    }, { status: 501 });
  }

  const tournamentId = tournamentMap?.pgaId;
  if (!tournamentId) {
    return noCacheJson({ error: "No PGA Tour ID mapped for this tournament" }, { status: 404 });
  }

  const cacheKey = FIELD_STATS_KEY_PREFIX + tournamentId;

  if (!forceRefresh) {
    const cached = await redis.get<CacheEntry>(cacheKey);
    if (cached && Date.now() - new Date(cached.fetchedAt).getTime() <= CACHE_TTL_MS) {
      return noCacheJson({ ok: true, fetchedAt: cached.fetchedAt, cached: true, players: cached.players });
    }
  }

  try {
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
        // leave them with empty stats rather than erroring the whole route.
      }
      return { id: p.id, name: p.displayName, position: null, rounds, total };
    });

    const fetchedAt = new Date().toISOString();
    await redis.set(cacheKey, { fetchedAt, players });

    return noCacheJson({ ok: true, fetchedAt, cached: false, players });
  } catch (e: any) {
    return noCacheJson({ error: e.message || "Failed to load field stats" }, { status: 500 });
  }
}
