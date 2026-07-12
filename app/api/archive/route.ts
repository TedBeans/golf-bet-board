import { NextRequest, NextResponse } from "next/server";
import { redis, BETS_KEY, ARCHIVE_KEY } from "../../../lib/redis";
import { Bet } from "../../../lib/seed";

export async function GET() {
  const archive = (await redis.get<Bet[]>(ARCHIVE_KEY)) || [];
  return NextResponse.json({ archive });
}

// Manual escape hatch: force a specific tournament+round off the live board
// and into the archive right now, regardless of whether every bet in it has
// actually resolved. Used for edge cases (withdrawals, bets that will never
// grade) rather than the normal flow, which archives automatically once a
// round is fully decided.
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { passcode, tournament, round } = body as { passcode: string; tournament: string; round: string };

  if (!passcode || passcode !== process.env.EDIT_PASSCODE) {
    return NextResponse.json({ error: "Wrong passcode" }, { status: 401 });
  }

  const bets = (await redis.get<Bet[]>(BETS_KEY)) || [];
  const toArchive = bets.filter((b) => b.t === tournament && b.r === round);
  const remaining = bets.filter((b) => !(b.t === tournament && b.r === round));

  if (toArchive.length === 0) {
    return NextResponse.json({ ok: true, archived: 0 });
  }

  const existingArchive = (await redis.get<Bet[]>(ARCHIVE_KEY)) || [];
  const archivedAt = new Date().toISOString();
  const stamped = toArchive.map((b) => ({ ...b, archivedAt }));

  await redis.set(ARCHIVE_KEY, [...existingArchive, ...stamped]);
  await redis.set(BETS_KEY, remaining);

  return NextResponse.json({ ok: true, archived: stamped.length });
}

// Permanently removes a tournament+round from the recap archive - for
// cleaning up junk entries (like a bet that got force-archived under the
// wrong tournament/round name and needs to just go away entirely).
export async function DELETE(req: NextRequest) {
  const body = await req.json();
  const { passcode, tournament, round } = body as { passcode: string; tournament: string; round: string };

  if (!passcode || passcode !== process.env.EDIT_PASSCODE) {
    return NextResponse.json({ error: "Wrong passcode" }, { status: 401 });
  }

  const existingArchive = (await redis.get<Bet[]>(ARCHIVE_KEY)) || [];
  const remaining = existingArchive.filter((b) => !(b.t === tournament && b.r === round));
  const removed = existingArchive.length - remaining.length;

  await redis.set(ARCHIVE_KEY, remaining);

  return NextResponse.json({ ok: true, removed });
}

// Overwrites the whole archive - used when re-attaching odds data to bets
// that already resolved and moved here, since the normal odds-loading flow
// otherwise only ever touches the live board.
export async function PUT(req: NextRequest) {
  const body = await req.json();
  const { passcode, archive } = body as { passcode: string; archive: Bet[] };

  if (!passcode || passcode !== process.env.EDIT_PASSCODE) {
    return NextResponse.json({ error: "Wrong passcode" }, { status: 401 });
  }
  if (!Array.isArray(archive)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  await redis.set(ARCHIVE_KEY, archive);
  return NextResponse.json({ ok: true });
}

// Restores a tournament+round from the recap archive back onto the live
// board - for a round that got archived before the "stay visible until the
// day is over" rule existed, or was force-archived by mistake.
export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { passcode, tournament, round } = body as { passcode: string; tournament: string; round: string };

  if (!passcode || passcode !== process.env.EDIT_PASSCODE) {
    return NextResponse.json({ error: "Wrong passcode" }, { status: 401 });
  }

  const existingArchive = (await redis.get<Bet[]>(ARCHIVE_KEY)) || [];
  const toRestore = existingArchive.filter((b) => b.t === tournament && b.r === round);
  const remainingArchive = existingArchive.filter((b) => !(b.t === tournament && b.r === round));

  if (toRestore.length === 0) {
    return NextResponse.json({ ok: true, restored: 0 });
  }

  const liveBets = (await redis.get<Bet[]>(BETS_KEY)) || [];
  const restored = toRestore.map((b) => {
    const { archivedAt, ...rest } = b;
    return rest as Bet;
  });

  await redis.set(BETS_KEY, [...liveBets, ...restored]);
  await redis.set(ARCHIVE_KEY, remainingArchive);

  return NextResponse.json({ ok: true, restored: restored.length });
}
