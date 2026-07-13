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
    };
  };
};

export const EMPTY_MAPPING: Mapping = { tournaments: {} };
