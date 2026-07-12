import { NextRequest, NextResponse } from "next/server";
import { redis, PARLAYS_KEY, PARLAY_ARCHIVE_KEY, BETS_KEY, ARCHIVE_KEY } from "../../../lib/redis";
import { Parlay, resolveLegStatuses, deriveParlayStatus } from "../../../lib/parlay";
import { Bet } from "../../../lib/seed";

export async function GET() {
  const parlays = (await redis.get<Parlay[]>(PARLAYS_KEY)) || [];
  return NextResponse.json({ parlays });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { passcode, parlay } = body as { passcode: string; parlay: Parlay };

  if (!passcode || passcode !== process.env.EDIT_PASSCODE) {
    return NextResponse.json({ error: "Wrong passcode" }, { status: 401 });
  }
  if (!parlay || !Array.isArray(parlay.legs) || parlay.legs.length === 0) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const [liveBets, archivedBets] = await Promise.all([
    redis.get<Bet[]>(BETS_KEY),
    redis.get<Bet[]>(ARCHIVE_KEY),
  ]);
  const legStatuses = resolveLegStatuses(parlay.legs, liveBets || [], archivedBets || []);
  parlay.status = deriveParlayStatus(legStatuses);

  const existing = (await redis.get<Parlay[]>(PARLAYS_KEY)) || [];
  await redis.set(PARLAYS_KEY, [...existing, parlay]);

  return NextResponse.json({ ok: true, parlay });
}

// Renames a parlay wherever it currently lives - still open, or already
// settled and sitting in the recap archive.
export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { passcode, parlayId, label } = body as { passcode: string; parlayId: string; label: string };

  if (!passcode || passcode !== process.env.EDIT_PASSCODE) {
    return NextResponse.json({ error: "Wrong passcode" }, { status: 401 });
  }
  if (!parlayId || !label?.trim()) {
    return NextResponse.json({ error: "Missing parlayId or label" }, { status: 400 });
  }

  const live = (await redis.get<Parlay[]>(PARLAYS_KEY)) || [];
  const liveMatch = live.find((p) => p.id === parlayId);
  if (liveMatch) {
    liveMatch.label = label.trim();
    await redis.set(PARLAYS_KEY, live);
    return NextResponse.json({ ok: true });
  }

  const archived = (await redis.get<Parlay[]>(PARLAY_ARCHIVE_KEY)) || [];
  const archivedMatch = archived.find((p) => p.id === parlayId);
  if (archivedMatch) {
    archivedMatch.label = label.trim();
    await redis.set(PARLAY_ARCHIVE_KEY, archived);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Parlay not found" }, { status: 404 });
}
