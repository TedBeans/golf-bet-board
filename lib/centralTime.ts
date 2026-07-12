// Teddy is always in Central time (Missouri) - tee times, suspension resume
// times, and "which day did this happen" are all computed against Central,
// regardless of where the server or any viewer actually is.

function centralPartsFromDate(d: Date): { dateStr: string; minutes: number; dateTimeStr: string } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value || "00";
  const dateStr = `${get("year")}-${get("month")}-${get("day")}`;
  const hh = get("hour");
  const mm = get("minute");
  const minutes = parseInt(hh, 10) * 60 + parseInt(mm, 10);
  const dateTimeStr = `${dateStr}T${hh}:${mm}`;
  return { dateStr, minutes, dateTimeStr };
}

export function nowInCentral(): { dateStr: string; minutes: number; dateTimeStr: string } {
  return centralPartsFromDate(new Date());
}

// Converts a stored ISO timestamp (e.g. archivedAt, always UTC) into the
// Central calendar date it actually fell on - not just the UTC date, which
// can be a day ahead of Central in the evening.
export function centralDateFromISO(iso: string): string {
  return centralPartsFromDate(new Date(iso)).dateStr;
}
