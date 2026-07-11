import { NextRequest, NextResponse } from "next/server";
import { fetchLeaderboard } from "../../../lib/espn";

export async function GET(req: NextRequest) {
  const eventId = req.nextUrl.searchParams.get("eventId");
  if (!eventId) {
    return NextResponse.json({ error: "Missing eventId" }, { status: 400 });
  }
  try {
    const competitors = await fetchLeaderboard(eventId);
    return NextResponse.json({ competitors });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Fetch failed" }, { status: 502 });
  }
}
