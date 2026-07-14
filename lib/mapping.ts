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
      dataSource?: "pgatour" | "theopen"; // which live feed to pull from - defaults to pgatour.
                                           // theopen.com relays its own data for The Open Championship;
                                           // PGA Tour's feed may or may not carry it - this lets you
                                           // flip a single tournament over to the fallback with no code change.
    };
  };
};

export const EMPTY_MAPPING: Mapping = { tournaments: {} };
