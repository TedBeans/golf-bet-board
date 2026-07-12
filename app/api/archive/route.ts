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
