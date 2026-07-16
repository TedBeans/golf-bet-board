import { NextResponse } from "next/server";
import { redis, PARLAY_ARCHIVE_KEY } from "../../../lib/redis";
import { Parlay } from "../../../lib/parlay";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function GET() {
  const archive = (await redis.get<Parlay[]>(PARLAY_ARCHIVE_KEY)) || [];
  return NextResponse.json({ archive });
}
