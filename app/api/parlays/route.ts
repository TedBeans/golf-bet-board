import { NextRequest, NextResponse } from "next/server";
import { redis, PARLAYS_KEY, PARLAY_ARCHIVE_KEY, BETS_KEY, ARCHIVE_KEY, DG_CUTLINE_KEY } from "../../../lib/redis";
import { Parlay, resolveLegStatuses, deriveParlayStatus } from "../../../lib/parlay";
import { Bet } from "../../../lib/seed";
import { CutlineProb } from "../../../lib/datagolf";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function GET() {
  const [parlays, cutlineProbs] = await Promise.all([
    redis.get<Parlay[]>(PARLAYS_KEY),
    redis.get<CutlineProb[]>(DG_CUTLINE_KEY),
  ]);
  return NextResponse.json({ parlays: parlays || [], cutlineProbs: cutlineProbs || [] });
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

// Full overwrite of the live parlays list - used for drag-and-drop
// reordering in the admin UI (same pattern as /api/archive's PUT, used
// there for the units-backfill tool).
export async function PUT(req: NextRequest) {
  const body = await req.json();
  const { passcode, parlays } = body as { passcode: string; parlays: Parlay[] };

  if (!passcode || passcode !== process.env.EDIT_PASSCODE) {
    return NextResponse.json({ error: "Wrong passcode" }, { status: 401 });
  }
  if (!Array.isArray(parlays)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  await redis.set(PARLAYS_KEY, parlays);
  return NextResponse.json({ ok: true });
}

// Renames a parlay wherever it currently lives - still open, or already
// settled and sitting in the recap archive. Also handles manually settling
// a still-live parlay to WIN/LOSS (manualStatus) - used when Teddy already
// knows the outcome and wants it off the live board without waiting for
// every leg to individually resolve on its own.
export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { passcode, parlayId, label, manualStatus } = body as {
    passcode: string;
    parlayId: string;
    label?: string;
    manualStatus?: "hit" | "miss";
  };

  if (!passcode || passcode !== process.env.EDIT_PASSCODE) {
    return NextResponse.json({ error: "Wrong passcode" }, { status: 401 });
  }
  if (!parlayId) {
    return NextResponse.json({ error: "Missing parlayId" }, { status: 400 });
  }

  if (manualStatus) {
    if (manualStatus !== "hit" && manualStatus !== "miss") {
      return NextResponse.json({ error: "manualStatus must be \"hit\" or \"miss\"" }, { status: 400 });
    }
    const live = (await redis.get<Parlay[]>(PARLAYS_KEY)) || [];
    const idx = live.findIndex((p) => p.id === parlayId);
    if (idx === -1) {
      return NextResponse.json({ error: "Parlay not found on the live board (already archived?)" }, { status: 404 });
    }
    const [settled] = live.splice(idx, 1);
    settled.manualStatus = manualStatus;
    settled.status = manualStatus;
    settled.archivedAt = new Date().toISOString();

    await redis.set(PARLAYS_KEY, live);
    const archived = (await redis.get<Parlay[]>(PARLAY_ARCHIVE_KEY)) || [];
    await redis.set(PARLAY_ARCHIVE_KEY, [...archived, settled]);

    return NextResponse.json({ ok: true, parlay: settled });
  }

  if (!label?.trim()) {
    return NextResponse.json({ error: "Missing label or manualStatus" }, { status: 400 });
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
