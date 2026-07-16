import { NextRequest, NextResponse } from "next/server";
import { fetchDataGolfData, findDataGolfPlayerMatch, fetchDataGolfDiagnostics } from "../../../lib/datagolf";

// Temporary route for verifying the DataGolf live-model page extraction.
// - /api/debug-datagolf              -> every player row extracted (count + first few, so the
//                                        response doesn't dump the entire field every time)
// - /api/debug-datagolf?player=Fleetwood -> that player's matched row in full
// - /api/debug-datagolf?full=1       -> every player row extracted, in full
// - /api/debug-datagolf?cutline=1    -> the aggregate cutline-probability distribution
//                                        (score -> %), no player rows
// - /api/debug-datagolf?diag=1       -> raw diagnostics (fetch status, html length/snippet,
//                                        how many JSON.parse(...) blobs were found, any parse
//                                        errors, cutline-shape candidates) - use this when the
//                                        plain call errors out, to see WHY rather than just
//                                        that it failed
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function GET(req: NextRequest) {
  const playerQuery = req.nextUrl.searchParams.get("player");
  const full = req.nextUrl.searchParams.get("full");
  const diag = req.nextUrl.searchParams.get("diag");
  const cutline = req.nextUrl.searchParams.get("cutline");
  const noStoreHeaders = { "Cache-Control": "no-store, no-cache, must-revalidate" };

  try {
    if (diag) {
      const info = await fetchDataGolfDiagnostics();
      return NextResponse.json(info, { headers: noStoreHeaders });
    }

    const data = await fetchDataGolfData();
    const players = data.players;

    if (cutline) {
      return NextResponse.json({ cutlineProbs: data.cutlineProbs }, { headers: noStoreHeaders });
    }

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

    return NextResponse.json({ count: players.length, sample: players.slice(0, 5), cutlineProbs: data.cutlineProbs }, { headers: noStoreHeaders });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Fetch failed", hint: "try ?diag=1 for raw diagnostics" }, { status: 502, headers: noStoreHeaders });
  }
}
