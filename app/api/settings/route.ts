import { NextRequest, NextResponse } from "next/server";
import { redis, SETTINGS_KEY } from "../../../lib/redis";
import { Settings, DEFAULT_SETTINGS } from "../../../lib/settings";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function GET() {
  const settings = (await redis.get<Settings>(SETTINGS_KEY)) || DEFAULT_SETTINGS;
  return NextResponse.json({ settings });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { passcode, settings } = body as { passcode: string; settings: Settings };

  if (!passcode || passcode !== process.env.EDIT_PASSCODE) {
    return NextResponse.json({ error: "Wrong passcode" }, { status: 401 });
  }
  if (!settings || typeof settings.unitSizeDollars !== "number") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  await redis.set(SETTINGS_KEY, settings);
  return NextResponse.json({ ok: true });
}
