import { NextRequest, NextResponse } from "next/server";
import { redis, BETS_KEY } from "../../../lib/redis";
import { SEED, Bet } from "../../../lib/seed";

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
