import { NextRequest } from "next/server";
import { redis, MAPPING_KEY } from "../../../../lib/redis";
import { Mapping } from "../../../../lib/mapping";
import { fetchAndCacheFieldStats } from "../../../../lib/fieldStats";
import { nowInCentral } from "../../../../lib/centralTime";
import { noCacheJson } from "../../../../lib/noCacheJson";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

// Runs once a day (~7pm Central, scheduled in vercel.json - Vercel Cron
// times are UTC and don't shift for daylight saving, so this is pinned to
// the CDT-equivalent UTC hour; during standard time in the off-season
// this'd land around 6pm Central instead of 7 - not worth the complexity
// of a DST-aware schedule for something that only needs to be "sometime
// after the last group finishes", not an exact time). Refreshes Greens/
// Fairways for every PGA Tour tournament whose date range covers today,
// since a cron job has no page context to know which tournament someone
// might be looking at - reads the same startDate/endDate Admin already
// uses for the weather widget.
//
// If Vercel's CRON_SECRET env var is set, requests must carry it (Vercel
// adds this automatically to its own cron requests) - if it's not set,
// this runs unauthenticated, which is fine given it only re-fetches and
// caches public leaderboard data, no destructive action.
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return noCacheJson({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const mapping = (await redis.get<Mapping>(MAPPING_KEY)) || { tournaments: {} };
  const today = nowInCentral().dateStr;

  const candidates = Object.entries(mapping.tournaments || {}).filter(([, tm]) => {
    if (!tm?.pgaId) return false;
    if (tm.dataSource === "theopen" || tm.dataSource === "dpwt") return false;
    if (!tm.startDate || !tm.endDate) return false;
    return today >= tm.startDate && today <= tm.endDate;
  });

  const results: Record<string, string> = {};
  for (const [name, tm] of candidates) {
    try {
      const entry = await fetchAndCacheFieldStats(tm.pgaId!);
      results[name] = `ok - ${entry.players.length} players, fetched ${entry.fetchedAt}`;
    } catch (e: any) {
      results[name] = `failed - ${e.message || "unknown error"}`;
    }
  }

  return noCacheJson({ ok: true, ranAt: new Date().toISOString(), todayCentral: today, tournaments: results });
}
