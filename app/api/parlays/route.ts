import { NextRequest, NextResponse } from "next/server";
import { redis, PARLAYS_KEY, PARLAY_ARCHIVE_KEY, BETS_KEY, ARCHIVE_KEY, DG_CUTLINE_KEY } from "../../../lib/redis";
import { Parlay, resolveLegStatuses, deriveParlayStatus } from "../../../lib/parlay";
import { Bet } from "../../../lib/seed";
import { CutlineProb } from "../../../lib/datagolf";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

type CutlineCacheEntry = { cutlineProbs: CutlineProb[]; fetchedAt: string };

// datagolf.com's live-model page doesn't rotate to the next event on any
// predictable schedule we can rely on, and our own fetch only happens
// lazily (when a personal MAKE_CUT bet needs it) - so between tournaments
// this value can sit unchanged for days, still showing last week's
// (by-then-irrelevant, often near-100%/0% "the cut is basically decided"
// degenerate) distribution. Rather than display something that's
// plausibly for the wrong tournament entirely, treat anything older than
// this as not current and just hide the strip until a fresh fetch lands.
const CUTLINE_MAX_AGE_MS = 20 * 60 * 60 * 1000; // 20 hours

export async function GET() {
  const [parlays, cutlineEntry] = await Promise.all([
    redis.get<Parlay[]>(PARLAYS_KEY),
    redis.get<CutlineCacheEntry | CutlineProb[]>(DG_CUTLINE_KEY),
  ]);

  let cutlineProbs: CutlineProb[] = [];
  if (Array.isArray(cutlineEntry)) {
    // Pre-existing cache written before the fetchedAt field was added -
    // no way to know its age, so treat it as stale rather than guess.
  } else if (cutlineEntry && Date.now() - new Date(cutlineEntry.fetchedAt).getTime() <= CUTLINE_MAX_AGE_MS) {
    cutlineProbs = cutlineEntry.cutlineProbs;
  }

  return NextResponse.json({ parlays: parlays || [], cutlineProbs });
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
// a parlay to WIN/LOSS/PUSH (manualStatus) - either a still-live one
// (moves it into the archive immediately, for when Teddy already knows the
// outcome and doesn't want to wait for every leg to individually resolve),
// or one that's already archived but graded wrong (corrects it in place -
// e.g. a leg that auto-graded off a bad or premature stat, or a leg that
// turned out to be a push on the sportsbook's end).
export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { passcode, parlayId, label, manualStatus, reopen } = body as {
    passcode: string;
    parlayId: string;
    label?: string;
    manualStatus?: "hit" | "miss" | "push";
    reopen?: boolean;
  };

  if (!passcode || passcode !== process.env.EDIT_PASSCODE) {
    return NextResponse.json({ error: "Wrong passcode" }, { status: 401 });
  }
  if (!parlayId) {
    return NextResponse.json({ error: "Missing parlayId" }, { status: 400 });
  }

  if (reopen) {
    // Move an archived parlay back to the live board as "live",
    // clearing manualStatus so sync can re-derive status from legs again.
    const archived = (await redis.get<Parlay[]>(PARLAY_ARCHIVE_KEY)) || [];
    const idx = archived.findIndex((p) => p.id === parlayId);
    if (idx === -1) {
      return NextResponse.json({ error: "Parlay not found in archive" }, { status: 404 });
    }
    const [restored] = archived.splice(idx, 1);
    delete restored.manualStatus;
    delete restored.archivedAt;
    restored.status = "live";
    await redis.set(PARLAY_ARCHIVE_KEY, archived);
    const live = (await redis.get<Parlay[]>(PARLAYS_KEY)) || [];
    await redis.set(PARLAYS_KEY, [...live, restored]);
    return NextResponse.json({ ok: true, parlay: restored });
  }

  if (manualStatus) {
    if (manualStatus !== "hit" && manualStatus !== "miss" && manualStatus !== "push") {
      return NextResponse.json({ error: "manualStatus must be \"hit\", \"miss\", or \"push\"" }, { status: 400 });
    }
    const live = (await redis.get<Parlay[]>(PARLAYS_KEY)) || [];
    const idx = live.findIndex((p) => p.id === parlayId);
    if (idx !== -1) {
      const [settled] = live.splice(idx, 1);
      settled.manualStatus = manualStatus;
      settled.status = manualStatus;
      settled.archivedAt = new Date().toISOString();

      await redis.set(PARLAYS_KEY, live);
      const archived = (await redis.get<Parlay[]>(PARLAY_ARCHIVE_KEY)) || [];
      await redis.set(PARLAY_ARCHIVE_KEY, [...archived, settled]);

      return NextResponse.json({ ok: true, parlay: settled });
    }

    // Not on the live board - see if it's already archived and just needs
    // correcting in place (nothing to move between lists in that case).
    const archived = (await redis.get<Parlay[]>(PARLAY_ARCHIVE_KEY)) || [];
    const archivedIdx = archived.findIndex((p) => p.id === parlayId);
    if (archivedIdx === -1) {
      return NextResponse.json({ error: "Parlay not found on the live board or in the archive" }, { status: 404 });
    }
    archived[archivedIdx].manualStatus = manualStatus;
    archived[archivedIdx].status = manualStatus;
    await redis.set(PARLAY_ARCHIVE_KEY, archived);
    return NextResponse.json({ ok: true, parlay: archived[archivedIdx] });
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

export async function DELETE(req: NextRequest) {
  const body = await req.json();
  const { passcode, parlayId } = body as { passcode: string; parlayId: string };
  if (!passcode || passcode !== process.env.EDIT_PASSCODE) {
    return NextResponse.json({ error: "Wrong passcode" }, { status: 401 });
  }
  if (!parlayId) return NextResponse.json({ error: "Missing parlayId" }, { status: 400 });

  const live = (await redis.get<Parlay[]>(PARLAYS_KEY)) || [];
  const liveFiltered = live.filter((p) => p.id !== parlayId);
  if (liveFiltered.length < live.length) {
    await redis.set(PARLAYS_KEY, liveFiltered);
    return NextResponse.json({ ok: true });
  }

  const archived = (await redis.get<Parlay[]>(PARLAY_ARCHIVE_KEY)) || [];
  const archFiltered = archived.filter((p) => p.id !== parlayId);
  if (archFiltered.length < archived.length) {
    await redis.set(PARLAY_ARCHIVE_KEY, archFiltered);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Parlay not found" }, { status: 404 });
}
