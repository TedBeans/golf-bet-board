import { NextResponse } from "next/server";
import { redis, PARLAY_ARCHIVE_KEY } from "../../../lib/redis";
import { Parlay } from "../../../lib/parlay";

export async function GET() {
  const archive = (await redis.get<Parlay[]>(PARLAY_ARCHIVE_KEY)) || [];
  return NextResponse.json({ archive });
}
