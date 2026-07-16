import { NextRequest, NextResponse } from "next/server";
import { redis, MAPPING_KEY } from "../../../lib/redis";
import { Mapping } from "../../../lib/mapping";
import { fetchPgaLeaderboard, fetchPlayerHoleScores } from "../../../lib/pgatour";
import { extractPlayers, findPlayerMatch } from "../../../lib/pgaMatch";
import { extractHoleScores, roundNumberFromLabel } from "../../../lib/pgaScorecard";
import { fetchOpenLeaderboard } from "../../../lib/theopen";
import { extractOpenPlayers, findOpenPlayerMatch, extractOpenHoleScorecard, computeOpenStats } from "../../../lib/openMatch";
import { computePositions, PositionEntry } from "../../../lib/positions";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tournament = searchParams.get("tournament");
  const player = searchParams.get("player");
  const round = searchParams.get("round") || "Round 1";

  if (!tournament || !player) {
    return NextResponse.json({ error: "Missing tournament or player" }, { status: 400 });
  }

  const mapping = (await redis.get<Mapping>(MAPPING_KEY)) || { tournaments: {} };
  const tournamentMap = mapping.tournaments[tournament];
  const roundNum = roundNumberFromLabel(round);

  // theopen.com path - was previously missing entirely, meaning a tournament
  // set to theopen.com would still silently pull PGA Tour's feed here, which
  // could show completely different (and coincidentally sometimes "more
  // correct" or "more stale") data than the main card was actually using.
  if (tournamentMap?.dataSource === "theopen") {
    try {
      const raw = await fetchOpenLeaderboard();
      const players = extractOpenPlayers(raw);
      const row = findOpenPlayerMatch(player, players);
      if (!row) {
        return NextResponse.json({ error: `No match for ${player} on theopen.com's leaderboard` }, { status: 404 });
      }

      // Same field-wide ranking already used for personal Winner/Top N bets
      // - computed ourselves from cumulative score-to-par, ties handled the
      // way a real leaderboard does.
      const entries: PositionEntry[] = players.map((p) => {
        const s = computeOpenStats(p, null);
        return { id: p.id, totalToPar: s.holesPlayed > 0 ? s.totalToPar : null };
      });
      const positions = computePositions(entries);
      const playerTotal = computeOpenStats(row, null);
      const totalToPar = playerTotal.holesPlayed > 0 ? playerTotal.totalToPar : null;
      const position = positions.get(row.id) ?? null;

      const scorecard = extractOpenHoleScorecard(row, roundNum);
      if (!scorecard) {
        return NextResponse.json({
          available: false,
          player: row.displayName,
          position,
          totalToPar,
          message: `No scorecard found for ${row.displayName} in ${round} yet.`,
        });
      }
      return NextResponse.json({ available: true, player: row.displayName, position, totalToPar, scorecard });
    } catch (e: any) {
      return NextResponse.json({ error: e.message || "Failed to load scorecard" }, { status: 500 });
    }
  }

  const tournamentId = tournamentMap?.pgaId;
  if (!tournamentId) {
    return NextResponse.json({ error: "No PGA Tour ID mapped for this tournament" }, { status: 404 });
  }

  try {
    const raw = await fetchPgaLeaderboard(tournamentId);
    const players = extractPlayers(raw);
    const row = findPlayerMatch(player, players);
    if (!row) {
      return NextResponse.json({ error: `No match for ${player} on the leaderboard` }, { status: 404 });
    }

    const entries: PositionEntry[] = players.map((p) => ({ id: p.id, totalToPar: p.total }));
    const positions = computePositions(entries);
    const position = positions.get(row.id) ?? null;
    const totalToPar = row.total;

    const holeJson = await fetchPlayerHoleScores(tournamentId, row.id);
    const scorecard = extractHoleScores(holeJson, roundNum);

    if (!scorecard) {
      return NextResponse.json({
        available: false,
        player: row.displayName,
        position,
        totalToPar,
        message: `No scorecard found for ${row.displayName} in ${round} yet.`,
      });
    }

    return NextResponse.json({ available: true, player: row.displayName, position, totalToPar, scorecard });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to load scorecard" }, { status: 500 });
  }
}
