import { NextRequest, NextResponse } from "next/server";
import { fetchPgaTeeTimes } from "../../../lib/pgatour";

// Debug route to inspect the tee-times payload.
// /api/debug-pga-teetimes?eventId=R2026525          -> top-level keys + preview
// /api/debug-pga-teetimes?eventId=R2026525&full=1   -> full decoded payload
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function GET(req: NextRequest) {
  const eventId = req.nextUrl.searchParams.get("eventId");
  const full = req.nextUrl.searchParams.get("full");
  const noStoreHeaders = { "Cache-Control": "no-store, no-cache, must-revalidate" };

  if (!eventId) {
    return NextResponse.json({ error: "Pass ?eventId=R2026xxx (e.g. R2026525 for 3M Open)" }, { status: 400 });
  }

  try {
    const payload = await fetchPgaTeeTimes(eventId);
    if (full) {
      return NextResponse.json(payload, { headers: noStoreHeaders });
    }
    const topLevelKeys = payload && typeof payload === "object" ? Object.keys(payload) : [];
    const preview = JSON.stringify(payload);
    return NextResponse.json({
      topLevelKeys,
      previewTruncated: preview.length > 4000,
      preview: preview.slice(0, 4000),
      hint: "Add &full=1 for the complete payload.",
    }, { headers: noStoreHeaders });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Fetch failed" }, { status: 502, headers: noStoreHeaders });
  }
}
