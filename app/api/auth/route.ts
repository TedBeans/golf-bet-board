import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Passcode check only - no Redis read or write of any kind. Exists
// specifically so the admin unlock flow has a side-effect-free way to
// verify a passcode, instead of (as it used to) "verifying" it by POSTing
// to /api/mapping: that endpoint does an unconditional redis.set on
// success, so using it as a login check meant every unlock silently
// overwrote the entire tournament mapping store with whatever the
// client's local `mapping` state happened to be at that exact moment -
// which, on a slow connection, can still be the EMPTY_MAPPING default the
// page starts with, if the real GET /api/mapping fetch (kicked off in the
// same page-load effect) hadn't resolved yet. That race is what wiped
// every tournament except the one just added in the same session.
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { passcode } = body as { passcode: string };

  if (!passcode || passcode !== process.env.EDIT_PASSCODE) {
    return NextResponse.json({ error: "Wrong passcode" }, { status: 401 });
  }
  return NextResponse.json({ ok: true });
}
