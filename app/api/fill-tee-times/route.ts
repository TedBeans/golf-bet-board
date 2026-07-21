import { NextRequest, NextResponse } from "next/server";
import { redis, BETS_KEY, MAPPING_KEY } from "../../../lib/redis";
import { Bet } from "../../../lib/seed";
import { fetchPgaTeeTimes, extractPgaTeeTimes, PgaTeeTimeRow } from "../../../lib/pgatour";

// Fills in tee times for any regular bet loaded without one (the paste
// format's TIME prefix is optional now) by matching each player against
// the PGA Tour tee-times feed. Visit once after loading time-less bets:
//
//   /api/fill-tee-times?passcode=XXXX
//
// Times are formatted in Central time to match how tee times have always
// been entered on this board. Only touches regular (non-personal) bets
// with an empty time; anything already carrying a time is left alone.
// theopen.com-sourced tournaments are skipped - this feed is PGA Tour
// only.
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

function normName(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z ]/g, "").replace(/\s+/g, " ").trim();
}

// Same exact/last-name/prefix/substring ladder as the score/stat matchers.
function matchTeeTime(playerName: string, rows: PgaTeeTimeRow[]): PgaTeeTimeRow | null {
  const target = normName(playerName);
  if (!target) return null;
  let m = rows.find((r) => normName(r.displayName) === target);
  if (m) return m;
  const targetLast = target.split(" ").slice(-1)[0];
  const lastMatches = rows.filter((r) => normName(r.lastName) === targetLast);
  if (lastMatches.length === 1) return lastMatches[0];
  m = rows.find((r) => normName(r.displayName).startsWith(target) || target.startsWith(normName(r.displayName)));
  if (m) return m;
  m = rows.find((r) => normName(r.displayName).includes(target) || target.includes(normName(r.displayName)));
  return m || null;
}

function formatCentral(ms: number): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(ms));
}

export async function GET(req: NextRequest) {
  const passcode = req.nextUrl.searchParams.get("passcode");
  const noStoreHeaders = { "Cache-Control": "no-store, no-cache, must-revalidate" };
  if (!passcode || passcode !== process.env.EDIT_PASSCODE) {
    return NextResponse.json({ error: "Wrong passcode - pass ?passcode=XXXX" }, { status: 401, headers: noStoreHeaders });
  }

  const [bets, mapping] = await Promise.all([
    redis.get<Bet[]>(BETS_KEY),
    redis.get<any>(MAPPING_KEY),
  ]);
  const allBets = bets || [];

  // One fetch per tournament+round actually needed, cached for the pass.
  const cache = new Map<string, PgaTeeTimeRow[] | null>();
  async function teeTimesFor(pgaId: string, roundInt: number): Promise<PgaTeeTimeRow[] | null> {
    const key = `${pgaId}:${roundInt}`;
    if (!cache.has(key)) {
      try {
        const payload = await fetchPgaTeeTimes(pgaId);
        cache.set(key, extractPgaTeeTimes(payload, roundInt));
      } catch {
        cache.set(key, null);
      }
    }
    return cache.get(key) ?? null;
  }

  let filled = 0;
  const unmatched: string[] = [];
  const skipped: string[] = [];

  for (const b of allBets) {
    if (b.personal || b.time) continue;
    const tm = mapping?.tournaments?.[b.t];
    if (!tm?.pgaId || (tm.dataSource && tm.dataSource !== "pgatour")) {
      skipped.push(`${b.player} (${b.t}: no pgaId or non-PGA data source)`);
      continue;
    }
    const roundMatch = (b.r || "").match(/(\d+)/);
    if (!roundMatch) {
      skipped.push(`${b.player} (${b.t}: couldn't read a round number from "${b.r}")`);
      continue;
    }
    const rows = await teeTimesFor(tm.pgaId, parseInt(roundMatch[1], 10));
    if (!rows || rows.length === 0) {
      unmatched.push(`${b.player} (${b.t} ${b.r}: no tee times available yet)`);
      continue;
    }
    const match = matchTeeTime(b.player, rows);
    if (!match) {
      unmatched.push(`${b.player} (${b.t} ${b.r}: no name match in tee-times feed)`);
      continue;
    }
    b.time = formatCentral(match.teeTimeMs);
    filled++;
  }

  if (filled > 0) {
    await redis.set(BETS_KEY, allBets);
  }

  return NextResponse.json({ filled, unmatched, skipped }, { headers: noStoreHeaders });
}
