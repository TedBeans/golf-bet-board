"use client";

// Server response headers (Cache-Control: no-store) stop Vercel's own edge
// and the browser's HTTP cache from serving anything stale - but some
// carrier-level transparent proxies on mobile networks cache GET responses
// keyed purely on the URL and don't reliably honor Cache-Control at all.
// The only thing that defeats a cache like that is a URL that's actually
// different every time. This appends a cache-busting timestamp to every
// request to our own data endpoints, so two people on different networks
// hitting "the same" URL are never actually requesting the same URL.
export function fetchFresh(url: string, init?: RequestInit): Promise<Response> {
  const sep = url.includes("?") ? "&" : "?";
  const bustedUrl = `${url}${sep}_=${Date.now()}`;
  return fetch(bustedUrl, { ...init, cache: "no-store" });
}
