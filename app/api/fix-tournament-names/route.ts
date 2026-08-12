import { NextRequest, NextResponse } from "next/server";
import { redis, BETS_KEY, ARCHIVE_KEY, PARLAYS_KEY, PARLAY_ARCHIVE_KEY } from "../../../lib/redis";
import { Bet } from "../../../lib/seed";
import { Parlay } from "../../../lib/parlay";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

// Strips trailing colons/periods/whitespace - "FedEx St. Jude Championship:"
// and "FedEx St. Jude Championship" need to end up as the exact same string,
// same as the parser-level fix in parsePersonal.ts/parseCombined.ts. This
// route is the one-time cleanup for data that was already written before
// that fix existed.
function normalize(name: string): string {
  return name.trim().replace(/[:.\s]+$/, "");
}

// One-click admin cleanup: rewrites any tournament name across bets,
// archive, and both parlay collections down to its normalized form,
// wherever the normalized form differs from what's stored. Only touches
// records that actually change - never rewrites a whole collection just
// because it was fetched.
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { passcode } = body as { passcode: string };

  if (!passcode || passcode !== process.env.EDIT_PASSCODE) {
    return NextResponse.json({ error: "Wrong passcode" }, { status: 401 });
  }

  const [bets, archive, liveParlays, parlayArchive] = await Promise.all([
    redis.get<Bet[]>(BETS_KEY),
    redis.get<Bet[]>(ARCHIVE_KEY),
    redis.get<Parlay[]>(PARLAYS_KEY),
    redis.get<Parlay[]>(PARLAY_ARCHIVE_KEY),
  ]);

  const renamed = new Set<string>();
  let betsChanged = 0;
  let archiveChanged = 0;
  let parlayLegsChanged = 0;

  function fixBetList(list: Bet[] | null): { list: Bet[] | null; changed: number } {
    if (!list) return { list, changed: 0 };
    let changed = 0;
    const next = list.map((b) => {
      const clean = normalize(b.t);
      if (clean !== b.t) {
        renamed.add(`"${b.t}" -> "${clean}"`);
        changed++;
        return { ...b, t: clean };
      }
      return b;
    });
    return { list: next, changed };
  }

  function fixParlayList(list: Parlay[] | null): { list: Parlay[] | null; changed: number } {
    if (!list) return { list, changed: 0 };
    let changed = 0;
    const next = list.map((p) => ({
      ...p,
      legs: p.legs.map((leg) => {
        const clean = normalize(leg.tournament);
        if (clean !== leg.tournament) {
          renamed.add(`"${leg.tournament}" -> "${clean}"`);
          changed++;
          return { ...leg, tournament: clean };
        }
        return leg;
      }),
    }));
    return { list: next, changed };
  }

  const betsFixed = fixBetList(bets);
  const archiveFixed = fixBetList(archive);
  const liveParlaysFixed = fixParlayList(liveParlays);
  const parlayArchiveFixed = fixParlayList(parlayArchive);

  betsChanged = betsFixed.changed;
  archiveChanged = archiveFixed.changed;
  parlayLegsChanged = liveParlaysFixed.changed + parlayArchiveFixed.changed;

  const writes: Promise<any>[] = [];
  if (betsFixed.changed > 0) writes.push(redis.set(BETS_KEY, betsFixed.list));
  if (archiveFixed.changed > 0) writes.push(redis.set(ARCHIVE_KEY, archiveFixed.list));
  if (liveParlaysFixed.changed > 0) writes.push(redis.set(PARLAYS_KEY, liveParlaysFixed.list));
  if (parlayArchiveFixed.changed > 0) writes.push(redis.set(PARLAY_ARCHIVE_KEY, parlayArchiveFixed.list));
  await Promise.all(writes);

  return NextResponse.json({
    ok: true,
    betsChanged,
    archiveChanged,
    parlayLegsChanged,
    renamed: [...renamed],
  });
}
