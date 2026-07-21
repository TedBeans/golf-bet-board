import { NextRequest, NextResponse } from "next/server";
import { introspectPgaQueryFields, fetchPgaTeeTimesGuess } from "../../../lib/pgatour";

// Discovery route for the tee-times query - we don't have this one
// captured from real network traffic the way the leaderboard/scorecard
// queries are, so this tries to find it instead of guessing blind:
//
// /api/debug-pga-teetimes?eventId=R2026100
//   -> runs a schema introspection query first (lists any query field name
//      containing "tee"/"round"/"time"), then tries a few plausible query
//      shapes and reports which ones actually resolve vs error out.
//
// Test this against The Open Championship's R2026100 right now (its tee
// times are already posted/complete per pgatour.com) rather than waiting
// on 3M Open's - it's the same API either way, and there's no reason to
// wait to validate this.
//
// Once one of the guesses succeeds (or introspection reveals the real
// field name), replace the whole guessing setup in lib/pgatour.ts with a
// single confirmed query built the same way fetchPgaLeaderboard etc. are,
// then wire it into the sync route to fill in bet.time automatically by
// matching player names the same way scores already get matched.
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function GET(req: NextRequest) {
  const eventId = req.nextUrl.searchParams.get("eventId");
  if (!eventId) {
    return NextResponse.json({ error: "Pass ?eventId=R2026xxx (the same event id used elsewhere, e.g. R2026100 for The Open)" }, { status: 400 });
  }

  const [introspection, guesses] = await Promise.all([
    introspectPgaQueryFields(),
    fetchPgaTeeTimesGuess(eventId),
  ]);

  return NextResponse.json(
    {
      introspectionFields: introspection.length > 0 ? introspection : "Introspection disabled or returned nothing - not unusual for a locked-down API, just means we rely on the guesses below (or a captured network request) instead.",
      guesses,
    },
    { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } }
  );
}
