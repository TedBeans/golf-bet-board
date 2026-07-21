import { NextRequest, NextResponse } from "next/server";
import { fetchPgaTeeTimes } from "../../../lib/pgatour";

// Tee-times debug route. The query itself (TeeTimesCompressedV2) is now
// confirmed - captured from pgatour.com's own tee-times page network
// traffic - but the decompressed payload's internal shape hasn't been
// mapped yet. This route decodes it live so the real structure can be
// seen straight from the API:
//
// /api/debug-pga-teetimes?eventId=R2026100          -> top-level keys + a
//                                                       truncated preview
// /api/debug-pga-teetimes?eventId=R2026100&full=1   -> the whole decoded
//                                                       payload
//
// Once the shape is confirmed (where rounds/groups/players/times live),
// wire a proper extractor into the sync route to auto-fill bet.time by
// player-name matching, same as scores/stats already match.
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function GET(req: NextRequest) {
  const eventId = req.nextUrl.searchParams.get("eventId");
  const full = req.nextUrl.searchParams.get("full");
  const noStoreHeaders = { "Cache-Control": "no-store, no-cache, must-revalidate" };

  if (!eventId) {
    return NextResponse.json({ error: "Pass ?eventId=R2026xxx (e.g. R2026100 for The Open)" }, { status: 400 });
  }

  try {
    const payload = await fetchPgaTeeTimes(eventId);

    if (full) {
      return NextResponse.json(payload, { headers: noStoreHeaders });
    }

    const topLevelKeys = payload && typeof payload === "object" ? Object.keys(payload) : [];
    const preview = JSON.stringify(payload);
    return NextResponse.json(
      {
        topLevelKeys,
        previewTruncated: preview.length > 4000,
        preview: preview.slice(0, 4000),
        hint: "Add &full=1 for the complete payload once the preview looks right.",
      },
      { headers: noStoreHeaders }
    );
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Fetch failed" }, { status: 502, headers: noStoreHeaders });
  }
}
