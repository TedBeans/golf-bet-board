import { NextRequest, NextResponse } from "next/server";
import { fetchPgaLeaderboard, fetchPlayerScorecardStats } from "../../../lib/pgatour";

// Temporary route for figuring out the real PGA Tour payload shapes.
// - /api/debug-pga?eventId=R2026518                      -> leaderboard
// - /api/debug-pga?eventId=R2026518&playerId=66701        -> that player's scorecard stats
// Chrome renders JSON responses as a collapsible tree, so you can expand
// down to find the fields we need and screenshot them.
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function GET(req: NextRequest) {
  const eventId = req.nextUrl.searchParams.get("eventId");
  const playerId = req.nextUrl.searchParams.get("playerId");
  const noStoreHeaders = { "Cache-Control": "no-store, no-cache, must-revalidate" };
  if (!eventId) {
    return NextResponse.json({ error: "Add ?eventId=R2026518 (or whatever tournament id) to the URL" }, { status: 400, headers: noStoreHeaders });
  }
  try {
    if (playerId) {
      const data = await fetchPlayerScorecardStats(eventId, playerId);
      return NextResponse.json(data, { headers: noStoreHeaders });
    }
    const data = await fetchPgaLeaderboard(eventId);
    return NextResponse.json(data, { headers: noStoreHeaders });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Fetch failed" }, { status: 502, headers: noStoreHeaders });
  }
}
