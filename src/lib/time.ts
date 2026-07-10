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

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

// Monday-first start of the week containing `date` — consistent with the
// Monday-first weekday indexing used elsewhere (e.g. the analytics route's
// `byWeekday` bucketing).
export function startOfLocalWeek(date: Date = new Date()): Date {
  const d = startOfLocalDay(date);
  const mondayFirstIndex = (d.getDay() + 6) % 7; // JS Sunday=0 → Monday-first index
  d.setDate(d.getDate() - mondayFirstIndex);
  return d;
}

export function startOfLocalMonth(date: Date = new Date()): Date {
  const d = startOfLocalDay(date);
  d.setDate(1);
  return d;
}

// Parses a "YYYY-MM-DD" date-only string (e.g. from an <input type="date">)
// as local midnight. `new Date("YYYY-MM-DD")` parses as UTC midnight, which
// can shift the calendar day when the server isn't running in UTC — this
// avoids that drift, consistent with this module's local-time assumption.
export function parseLocalDateInput(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

export type DateRangePreset = "today" | "week" | "month" | "custom";

export interface DateRange {
  from: Date;
  // Exclusive upper bound — the start of the day *after* the last included day.
  to: Date;
}

export interface ResolveDateRangeOptions {
  // Explicit boundaries for the "custom" preset — accepts "YYYY-MM-DD"
  // strings (as produced by <input type="date">) or Date objects. Both are
  // treated as calendar days: `to` is inclusive of its whole day.
  from?: string | Date;
  to?: string | Date;
  // Reference "now" for the relative presets — defaults to the current time.
  // Exposed mainly so callers (and tests) can pin the range deterministically.
  now?: Date;
}

function asLocalDay(value: string | Date): Date {
  return typeof value === "string" ? parseLocalDateInput(value) : startOfLocalDay(value);
}

// Resolves a date-range preset (plus optional explicit bounds for "custom")
// into a concrete [from, to) interval in server-local time, for use in
// Prisma `gte`/`lt` filters on the reports and analytics routes.
export function resolveDateRange(
  preset: DateRangePreset,
  options: ResolveDateRangeOptions = {}
): DateRange {
  const now = options.now ?? new Date();

  switch (preset) {
    case "today": {
      const from = startOfLocalDay(now);
      return { from, to: addDays(from, 1) };
    }
    case "week": {
      const from = startOfLocalWeek(now);
      return { from, to: addDays(from, 7) };
    }
    case "month": {
      const from = startOfLocalMonth(now);
      return { from, to: new Date(from.getFullYear(), from.getMonth() + 1, 1) };
    }
    case "custom": {
      if (!options.from || !options.to) {
        throw new Error("resolveDateRange: 'custom' preset requires both from and to");
      }
      const from = asLocalDay(options.from);
      const to = addDays(asLocalDay(options.to), 1);
      return { from, to };
    }
  }
}
