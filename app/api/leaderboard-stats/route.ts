import { NextRequest } from "next/server";
import { redis, MAPPING_KEY } from "../../../lib/redis";
import { Mapping } from "../../../lib/mapping";
import { fieldStatsCacheKey, fetchAndCacheFieldStats, FieldStatsCacheEntry } from "../../../lib/fieldStats";
import { noCacheJson } from "../../../lib/noCacheJson";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

// This data only changes once a round is over, so it's refreshed once a
// day by a scheduled job (app/api/cron/leaderboard-stats/route.ts, ~7pm
// Central) rather than being fetched live - fetching a full field's stats
// is one call PER PLAYER (see lib/fieldStats.ts), so there's real cost to
// polling this on any kind of live interval for data that doesn't change
// that often. This route just reads whatever the daily job last cached.
// ?refresh=1 is a manual escape hatch (e.g. the cron hasn't run yet for a
// tournament that just started) - not meant for routine use.
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

  if (!forceRefresh) {
    const cached = await redis.get<FieldStatsCacheEntry>(fieldStatsCacheKey(tournamentId));
    if (cached) {
      return noCacheJson({ ok: true, fetchedAt: cached.fetchedAt, players: cached.players });
    }
    return noCacheJson({
      error: "No Greens/Fairways data cached yet for this tournament - the daily job runs around 7pm Central, or use Admin's 'Refresh now' button.",
    }, { status: 404 });
  }

  try {
    const entry = await fetchAndCacheFieldStats(tournamentId);
    return noCacheJson({ ok: true, fetchedAt: entry.fetchedAt, players: entry.players });
  } catch (e: any) {
    return noCacheJson({ error: e.message || "Failed to load field stats" }, { status: 500 });
  }
}
