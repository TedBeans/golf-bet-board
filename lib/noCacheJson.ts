import { NextResponse } from "next/server";

// Belt-and-suspenders: a route's `dynamic`/`revalidate`/`fetchCache`
// exports stop Next.js's own rendering/fetch cache from serving anything
// stale, but they don't guarantee that an intermediate cache in front of
// the function - Vercel's CDN edge, a mobile carrier's transparent proxy,
// the browser's own HTTP cache - respects that. Those layers key off the
// actual HTTP response headers. Without an explicit Cache-Control header,
// two people on different networks/regions hitting the "same" URL can
// silently get different cached snapshots of the data - exactly the kind
// of bug that's invisible on your own device and only shows up as "it's
// missing on my screen but not yours."
export function noCacheJson(body: any, init?: { status?: number }) {
  return NextResponse.json(body, {
    ...init,
    headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
  });
}
