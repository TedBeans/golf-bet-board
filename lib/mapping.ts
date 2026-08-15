export type SuspendType = "none" | "fog" | "storm" | "dark";

export type Mapping = {
  tournaments: {
    // value is the "Rxxxxxxx" id from the pgatour.com tournament URL
    [tournamentName: string]: {
      pgaId: string;
      suspendedType?: SuspendType;
      suspendedUntil?: string; // "YYYY-MM-DDTHH:mm", Central time, matches a datetime-local input
      dateRange?: string; // e.g. "July 9-12, 2026" - just for display on the recap page
      venue?: string; // course name, e.g. "Royal Birkdale Golf Club"
      location?: string; // e.g. "Southport, England"
      latitude?: number; // for weather lookups
      longitude?: number;
      startDate?: string; // "YYYY-MM-DD" - actual tournament start, for weather lookups
      endDate?: string; // "YYYY-MM-DD"
      notes?: string; // free text - purse, defending champ, field notes, etc.
      upcoming?: boolean; // show on the live board's "upcoming this week" widget
      roundPar?: number; // this course's per-round par (e.g. 70/71/72) - needed to convert
                          // a raw strokes line (e.g. "Under 68.5") into to-par phrasing ("-2 or better")
      front9Par?: number; // holes 1-9 only - needed for "Front 9 Score" bets (often != roundPar/2,
                           // e.g. Royal Birkdale plays 34 out / 36 in)
      back9Par?: number; // holes 10-18 only
      dataSource?: "pgatour" | "theopen" | "dpwt"; // which live feed to pull from - defaults to pgatour.
      dpwt?: {
        eventId: string; // numeric event id used in the Scorecard REST URL, e.g. "2026131" -
                          // NOT the same id system as the "eventId" seen in this tour's
                          // WebSocket traffic. Get this from a Network capture of the
                          // Scorecard endpoint URL itself.
        holePars: number[]; // index 0 = hole 1, length 18 - seeded once from a pasted
                             // getGolfTournamentGroupScores capture (see parseDpwtRosterCapture
                             // in lib/dpwt.ts), since the live per-player scorecard endpoint
                             // doesn't include par.
        players: Record<string, number>; // "Firstname Lastname" -> numeric playerId, seeded the
                                          // same way. Only needs to cover players actually bet on,
                                          // not the whole field.
      };
                                           // theopen.com relays its own data for The Open Championship;
                                           // PGA Tour's feed may or may not carry it - this lets you
                                           // flip a single tournament over to the fallback with no code change.
      cutLine?: number; // score-to-par cutoff (e.g. 2 for "+2") - enter this once the real cut is
                         // announced. Personal "Make Cut" plays auto-grade off this the moment each
                         // player's round 2 is fully finished; leave unset before the cut happens
                         // (nothing grades until it's set, same as any other bet missing a required input).
      courseType?: "parkland" | "links" | "desert" | "other"; // for filtering in the Analysis page
      leaderboardLiveUntil?: string; // ISO timestamp - manual override that forces the live
                                      // leaderboard to show (instead of course history) until this
                                      // time, regardless of what the automatic "has this tournament
                                      // started" bet-status check says. A one-click escape hatch for
                                      // whenever that automatic check hasn't caught up yet.
    };
  };
};

export const EMPTY_MAPPING: Mapping = { tournaments: {} };

// Short display label for whichever tour a tournament's data comes from -
// used for the badge on the live board and for bucketing the recap pages
// by tour. Defaults to PGA Tour since that's the dataSource default too.
export function tourLabel(dataSource: string | undefined): string {
  if (dataSource === "dpwt") return "DP World Tour";
  if (dataSource === "theopen") return "The Open";
  return "PGA Tour";
}
