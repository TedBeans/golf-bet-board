import { NextRequest, NextResponse } from "next/server";
import { fetchOpenLeaderboard, fetchOpenStatistics, fetchOpenCoursePars } from "../../../lib/theopen";
import { extractOpenPlayers, findOpenPlayerMatch, computeOpenStats } from "../../../lib/openMatch";

// Temporary route for verifying theopen.com's feed once Round 1 goes live.
// - /api/debug-open                      -> raw traditional (leaderboard) feed
// - /api/debug-open?feed=statistics       -> raw statistics feed (check if
//                                            greensInRegulation.stats has
//                                            per-player entries yet)
// - /api/debug-open?feed=coursepars       -> raw course par feed
// - /api/debug-open?player=Detry          -> that player matched + our
//                                            derived stats (birdies/bogeys/
//                                            pars/score), round-by-round
export async function GET(req: NextRequest) {
  const feed = req.nextUrl.searchParams.get("feed") || "traditional";
  const playerQuery = req.nextUrl.searchParams.get("player");

  try {
    if (feed === "statistics") {
      return NextResponse.json(await fetchOpenStatistics());
    }
    if (feed === "coursepars") {
      return NextResponse.json(await fetchOpenCoursePars());
    }

    const raw = await fetchOpenLeaderboard();

    if (playerQuery) {
      const players = extractOpenPlayers(raw);
      const match = findOpenPlayerMatch(playerQuery, players);
      if (!match) {
        return NextResponse.json({ error: `No match for "${playerQuery}"`, availableCount: players.length }, { status: 404 });
      }
      const perRound = match.rounds.map((r) => ({ round: r.id, ...computeOpenStats(match, r.id) }));
      return NextResponse.json({ player: match.displayName, id: match.id, perRound });
    }

    return NextResponse.json(raw);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Fetch failed" }, { status: 502 });
  }
}
