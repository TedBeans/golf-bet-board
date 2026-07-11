import { NextRequest, NextResponse } from "next/server";
import { fetchPgaLeaderboard } from "../../../lib/pgatour";

// Temporary route for figuring out the real PGA Tour payload shape.
// Visit e.g. /api/debug-pga?eventId=R2026518 directly in the browser -
// Chrome renders JSON responses as a collapsible tree, so you can expand
// down to a single player and screenshot the field names.
export async function GET(req: NextRequest) {
  const eventId = req.nextUrl.searchParams.get("eventId");
  if (!eventId) {
    return NextResponse.json({ error: "Add ?eventId=R2026518 (or whatever tournament id) to the URL" }, { status: 400 });
  }
  try {
    const data = await fetchPgaLeaderboard(eventId);
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Fetch failed" }, { status: 502 });
  }
}
