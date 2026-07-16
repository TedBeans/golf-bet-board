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
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function GET(req: NextRequest) {
  const feed = req.nextUrl.searchParams.get("feed") || "traditional";
  const playerQuery = req.nextUrl.searchParams.get("player");
  const noStoreHeaders = { "Cache-Control": "no-store, no-cache, must-revalidate" };

  try {
    if (feed === "statistics") {
      return NextResponse.json(await fetchOpenStatistics(), { headers: noStoreHeaders });
    }
    if (feed === "coursepars") {
      return NextResponse.json(await fetchOpenCoursePars(), { headers: noStoreHeaders });
    }

    const raw = await fetchOpenLeaderboard();

    if (playerQuery) {
      const players = extractOpenPlayers(raw);
      const match = findOpenPlayerMatch(playerQuery, players);
      if (!match) {
        return NextResponse.json({ error: `No match for "${playerQuery}"`, availableCount: players.length }, { status: 404, headers: noStoreHeaders });
      }
      const perRound = match.rounds.map((r) => ({ round: r.id, ...computeOpenStats(match, r.id) }));
      return NextResponse.json({ player: match.displayName, id: match.id, perRound }, { headers: noStoreHeaders });
    }

    return NextResponse.json(raw, { headers: noStoreHeaders });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Fetch failed" }, { status: 502, headers: noStoreHeaders });
  }
}
