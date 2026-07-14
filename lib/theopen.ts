// theopen.com's own live scoring feed - captured from the site's own
// Network tab. Unlike PGA Tour's GraphQL+gzip setup, this is plain REST:
// GET requests returning uncompressed JSON, keyed by ?feedType=.
//
// Base URL inferred from a confirmed sibling request
// (https://www.theopen.com/api/LiveComponentsScannerApi/Config) - Config,
// scoring, GetVersionInfo, and GetPlayersInfo all appeared as separate
// requests under what looks like the same shared API root in the site's
// own Network tab. Worth a quick sanity check against /api/debug-open once
// live - if this guess is wrong, the fix is just this one line.
const OPEN_BASE_URL = "https://www.theopen.com/api/LiveComponentsScannerApi";

async function openFetch(feedType: "traditional" | "coursepars" | "statistics"): Promise<any> {
  const res = await fetch(`${OPEN_BASE_URL}/scoring?feedType=${feedType}`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Referer: "https://www.theopen.com/leaderboard",
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`theopen.com fetch failed (${res.status}) for feedType=${feedType}`);
  return res.json();
}

// Full leaderboard: every player, every round played so far, hole-by-hole
// (holeId/holePar/playerStrokes) - see lib/openMatch.ts and
// lib/openScorecard.ts for how this gets turned into the same shape the
// rest of the app already expects from PGA Tour's feed.
export async function fetchOpenLeaderboard(): Promise<any> {
  return openFetch("traditional");
}

// Course/hole par reference data - confirmed static across all 4 rounds
// (Royal Birkdale plays to par 70 every round). Only useful once, to
// auto-fill a tournament's roundPar in the admin rather than typing it in
// by hand; not needed on every sync tick.
export async function fetchOpenCoursePars(): Promise<any> {
  return openFetch("coursepars");
}

// Field-wide stats (driving distance, GIR%, etc). As of the pre-tournament
// capture, every category's `stats` array is empty - the site doesn't
// populate this until play actually starts. Whether `stats[]` turns out to
// hold one entry per player (needed for GIR bets) is still unverified -
// check this once Thursday's round is live before relying on it.
export async function fetchOpenStatistics(): Promise<any> {
  return openFetch("statistics");
}
