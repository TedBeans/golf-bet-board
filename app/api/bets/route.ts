import { NextRequest, NextResponse } from "next/server";
import { redis, BETS_KEY } from "../../../lib/redis";
import { SEED, Bet } from "../../../lib/seed";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function GET() {
  let bets = await redis.get<Bet[]>(BETS_KEY);
  if (!bets) {
    bets = SEED;
    await redis.set(BETS_KEY, bets);
  }
  return NextResponse.json({ bets });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { passcode, bets } = body as { passcode: string; bets: Bet[] };

  if (!passcode || passcode !== process.env.EDIT_PASSCODE) {
    return NextResponse.json({ error: "Wrong passcode" }, { status: 401 });
  }
  if (!Array.isArray(bets)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  await redis.set(BETS_KEY, bets);
  return NextResponse.json({ ok: true });
}

// Archives a single personal bet immediately - moves it from BETS_KEY to
// ARCHIVE_KEY with the current timestamp, same as the bulk end-of-round
// archive in the sync route.
export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { passcode, betId } = body as { passcode: string; betId: string };
  if (!passcode || passcode !== process.env.EDIT_PASSCODE) {
    return NextResponse.json({ error: "Wrong passcode" }, { status: 401 });
  }
  if (!betId) return NextResponse.json({ error: "Missing betId" }, { status: 400 });

  const bets = (await redis.get<Bet[]>(BETS_KEY)) || [];
  const idx = bets.findIndex((b) => b.id === betId);
  if (idx === -1) return NextResponse.json({ error: "Bet not found" }, { status: 404 });

  const [archived] = bets.splice(idx, 1);
  archived.archivedAt = new Date().toISOString();
  await redis.set(BETS_KEY, bets);

  const { ARCHIVE_KEY } = await import("../../../lib/redis");
  const existing = (await redis.get<Bet[]>(ARCHIVE_KEY)) || [];
  await redis.set(ARCHIVE_KEY, [...existing, archived]);

  return NextResponse.json({ ok: true });
}
