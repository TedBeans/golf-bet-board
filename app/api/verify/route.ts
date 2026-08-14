import { redis, BETS_KEY, ARCHIVE_KEY } from "../../../lib/redis";
import { Bet } from "../../../lib/seed";
import { noCacheJson } from "../../../lib/noCacheJson";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

// Cheap, deterministic fingerprint - not cryptographic, just needs to
// change if the underlying data changes, so two people can compare a
// short string instead of a full JSON dump.
function fingerprint(s: string): string {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) {
    const ch = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h1 >>> 0).toString(16).padStart(8, "0") + (h2 >>> 0).toString(16).padStart(8, "0");
}

// Direct, always-fresh read straight from Redis - this route exists purely
// to answer "is my device actually in sync with everyone else's" without
// any of the app's normal client state or caching in the way. Two people
// with the same fingerprint are guaranteed to be looking at the exact same
// underlying data, regardless of what either of their screens shows.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const playerQuery = searchParams.get("player")?.toLowerCase().trim();

  const [bets, archive] = await Promise.all([
    redis.get<Bet[]>(BETS_KEY),
    redis.get<Bet[]>(ARCHIVE_KEY),
  ]);

  const allBets = [...(bets || []), ...(archive || [])];

  // Sort by id so the fingerprint is stable regardless of array order.
  const summary = allBets
    .map((b) => `${b.id}:${b.status}:${b.stat ?? ""}:${b.thru ?? ""}`)
    .sort()
    .join("|");

  // Per-tournament-round breakdown, same W/L/units logic the recap page
  // uses, so this can be compared line-by-line against what's on screen.
  const groups: Record<string, { wins: number; losses: number; live: number; pending: number }> = {};
  for (const b of allBets) {
    const key = `${b.t} · ${b.r}`;
    groups[key] = groups[key] || { wins: 0, losses: 0, live: 0, pending: 0 };
    if (b.status === "hit") groups[key].wins++;
    else if (b.status === "miss") groups[key].losses++;
    else if (b.status === "live") groups[key].live++;
    else groups[key].pending++;
  }

  // Optional: raw records for a specific player, including every date
  // field - useful for chasing a "shows up everywhere except Calendar"
  // kind of bug, since Calendar buckets by loadedDate (falling back to
  // archivedAt) while every other view just checks presence/status.
  const matches = playerQuery
    ? allBets
        .filter((b) => b.player?.toLowerCase().includes(playerQuery))
        .map((b) => ({
          id: b.id, player: b.player, bet: b.bet, t: b.t, r: b.r, personal: !!b.personal,
          status: b.status, loadedDate: b.loadedDate ?? null, archivedAt: b.archivedAt ?? null,
          inLiveArray: (bets || []).some((x) => x.id === b.id),
          inArchiveArray: (archive || []).some((x) => x.id === b.id),
        }))
    : undefined;

  return noCacheJson({
    generatedAt: new Date().toISOString(),
    betsInProgress: (bets || []).length,
    betsArchived: (archive || []).length,
    totalBets: allBets.length,
    fingerprint: fingerprint(summary),
    byTournamentRound: groups,
    ...(matches ? { matches } : {}),
  });
}
