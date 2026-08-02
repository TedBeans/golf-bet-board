import { NextRequest, NextResponse } from "next/server";
import { redis, MAPPING_KEY } from "../../../lib/redis";
import { Mapping } from "../../../lib/mapping";
import { fetchPgaLeaderboard } from "../../../lib/pgatour";
import { extractPlayers } from "../../../lib/pgaMatch";
import { fetchOpenLeaderboard } from "../../../lib/theopen";
import { extractOpenPlayers, computeOpenStats } from "../../../lib/openMatch";
import { computePositions, PositionEntry, positionRank } from "../../../lib/positions";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export type LeaderboardRow = {
  id: string;
  name: string;
  position: string | null;
  totalToPar: number | null;
  todayToPar: number | null;
  thru: number | null;
};

// Sorts by rank (position label like "T7" -> 7), keeping tied players in
// their original relative order and pushing anyone with no score yet
// (hasn't teed off, cut, WD) to the bottom rather than the top.
function sortByPosition(rows: LeaderboardRow[]): LeaderboardRow[] {
  return [...rows].sort((a, b) => {
    const ra = positionRank(a.position);
    const rb = positionRank(b.position);
    if (ra === null && rb === null) return a.name.localeCompare(b.name);
    if (ra === null) return 1;
    if (rb === null) return -1;
    return ra - rb;
  });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tournament = searchParams.get("tournament");
  if (!tournament) {
    return NextResponse.json({ error: "Missing tournament" }, { status: 400 });
  }

  const mapping = (await redis.get<Mapping>(MAPPING_KEY)) || { tournaments: {} };
  const tournamentMap = mapping.tournaments[tournament];

  if (tournamentMap?.dataSource === "theopen") {
    try {
      const raw = await fetchOpenLeaderboard();
      const players = extractOpenPlayers(raw);
      const entries: PositionEntry[] = players.map((p) => {
        const s = computeOpenStats(p, null);
        return { id: p.id, totalToPar: s.holesPlayed > 0 ? s.totalToPar : null };
      });
      const positions = computePositions(entries);

      const rows: LeaderboardRow[] = players.map((p) => {
        const total = computeOpenStats(p, null);
        // "Today" = whichever round is furthest along for this player -
        // theopen.com's feed carries one entry per round actually played.
        const latestRoundId = p.rounds.length > 0 ? Math.max(...p.rounds.map((r) => r.id)) : null;
        const today = latestRoundId !== null ? computeOpenStats(p, latestRoundId) : null;
        return {
          id: p.id,
          name: p.displayName,
          position: positions.get(p.id) ?? null,
          totalToPar: total.holesPlayed > 0 ? total.totalToPar : null,
          todayToPar: today && today.holesPlayed > 0 ? today.scoreToPar : null,
          thru: today && today.holesPlayed > 0 ? today.thru : null,
        };
      });

      return NextResponse.json({ ok: true, players: sortByPosition(rows) });
    } catch (e: any) {
      return NextResponse.json({ error: e.message || "Failed to load leaderboard" }, { status: 500 });
    }
  }

  const tournamentId = tournamentMap?.pgaId;
  if (!tournamentId) {
    return NextResponse.json({ error: "No PGA Tour ID mapped for this tournament" }, { status: 404 });
  }

  try {
    const raw = await fetchPgaLeaderboard(tournamentId);
    const players = extractPlayers(raw);
    const entries: PositionEntry[] = players.map((p) => ({ id: p.id, totalToPar: p.total }));
    const positions = computePositions(entries);

    const rows: LeaderboardRow[] = players.map((p) => ({
      id: p.id,
      name: p.displayName,
      position: positions.get(p.id) ?? null,
      totalToPar: p.total,
      todayToPar: p.score,
      thru: p.thru,
    }));

    return NextResponse.json({ ok: true, players: sortByPosition(rows) });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to load leaderboard" }, { status: 500 });
  }
}
