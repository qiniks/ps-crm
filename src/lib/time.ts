// Day-boundary helpers for the reports and analytics routes.
//
// These compute boundaries in the server process's local timezone. That's a
// deliberate simplification, not an oversight: the app currently assumes
// every tenant (club) operates in the same timezone as the deployment (see
// README "Known limitations"). If clubs ever span multiple timezones, these
// need a per-tenant timezone instead of relying on the server's.

export function startOfLocalDay(date: Date = new Date()): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function startOfLocalDayDaysAgo(days: number, from: Date = new Date()): Date {
  const d = new Date(from);
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d;
}

// YYYY-MM-DD in local time, used to key/group by calendar day.
export function localDayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
