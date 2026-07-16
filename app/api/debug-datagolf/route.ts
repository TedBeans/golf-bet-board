import { NextRequest, NextResponse } from "next/server";
import { fetchDataGolfPredictions, findDataGolfPlayerMatch } from "../../../lib/datagolf";

// Temporary route for verifying the DataGolf live-model page extraction.
// - /api/debug-datagolf              -> every player row extracted (count + first few, so the
//                                        response doesn't dump the entire field every time)
// - /api/debug-datagolf?player=Fleetwood -> that player's matched row in full
// - /api/debug-datagolf?full=1       -> every player row extracted, in full
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function GET(req: NextRequest) {
  const playerQuery = req.nextUrl.searchParams.get("player");
  const full = req.nextUrl.searchParams.get("full");
  const noStoreHeaders = { "Cache-Control": "no-store, no-cache, must-revalidate" };

  try {
    const players = await fetchDataGolfPredictions();

    if (playerQuery) {
      const match = findDataGolfPlayerMatch(playerQuery, players);
      if (!match) {
        return NextResponse.json({ error: `No match for "${playerQuery}"`, availableCount: players.length }, { status: 404, headers: noStoreHeaders });
      }
      return NextResponse.json(match, { headers: noStoreHeaders });
    }

    if (full) {
      return NextResponse.json({ count: players.length, players }, { headers: noStoreHeaders });
    }

    return NextResponse.json({ count: players.length, sample: players.slice(0, 5) }, { headers: noStoreHeaders });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Fetch failed" }, { status: 502, headers: noStoreHeaders });
  }
}
