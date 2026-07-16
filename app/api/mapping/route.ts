import { NextRequest, NextResponse } from "next/server";
import { redis, MAPPING_KEY } from "../../../lib/redis";
import { Mapping, EMPTY_MAPPING } from "../../../lib/mapping";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function GET() {
  const mapping = (await redis.get<Mapping>(MAPPING_KEY)) || EMPTY_MAPPING;
  return NextResponse.json({ mapping });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { passcode, mapping } = body as { passcode: string; mapping: Mapping };

  if (!passcode || passcode !== process.env.EDIT_PASSCODE) {
    return NextResponse.json({ error: "Wrong passcode" }, { status: 401 });
  }
  if (!mapping || typeof mapping !== "object") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  await redis.set(MAPPING_KEY, mapping);
  return NextResponse.json({ ok: true });
}
