import { describe, expect, it } from "vitest";
import {
  addDays,
  localDayKey,
  parseLocalDateInput,
  resolveDateRange,
  startOfLocalDay,
  startOfLocalDayDaysAgo,
  startOfLocalMonth,
  startOfLocalWeek,
} from "./time";

describe("startOfLocalDay", () => {
  it("zeroes out the time-of-day, keeping the calendar date", () => {
    const d = startOfLocalDay(new Date(2026, 6, 8, 23, 59, 59));
    expect(d).toEqual(new Date(2026, 6, 8, 0, 0, 0, 0));
  });

  it("defaults to now when no date is given", () => {
    const d = startOfLocalDay();
    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);
  });
});

describe("startOfLocalDayDaysAgo", () => {
  it("subtracts whole days and zeroes the time", () => {
    const from = new Date(2026, 6, 8, 15, 30);
    expect(startOfLocalDayDaysAgo(0, from)).toEqual(new Date(2026, 6, 8, 0, 0, 0, 0));
    expect(startOfLocalDayDaysAgo(7, from)).toEqual(new Date(2026, 6, 1, 0, 0, 0, 0));
  });

  it("crosses month boundaries correctly", () => {
    const from = new Date(2026, 6, 3, 10, 0); // July 3
    expect(startOfLocalDayDaysAgo(5, from)).toEqual(new Date(2026, 5, 28, 0, 0, 0, 0)); // June 28
  });
});

describe("localDayKey", () => {
  it("formats as YYYY-MM-DD with zero-padding", () => {
    expect(localDayKey(new Date(2026, 0, 5))).toBe("2026-01-05");
    expect(localDayKey(new Date(2026, 10, 30))).toBe("2026-11-30");
  });
});

describe("addDays", () => {
  it("adds whole days, preserving time-of-day", () => {
    expect(addDays(new Date(2026, 6, 8, 10, 30), 3)).toEqual(new Date(2026, 6, 11, 10, 30));
  });

  it("supports negative offsets and crosses month boundaries", () => {
    expect(addDays(new Date(2026, 6, 3, 0, 0), -5)).toEqual(new Date(2026, 5, 28, 0, 0));
  });
});

describe("startOfLocalWeek", () => {
  // 2024-01-01 is a Monday (also relied on elsewhere for weekday rendering).
  it("returns the same day, zeroed, when given a Monday", () => {
    expect(startOfLocalWeek(new Date(2024, 0, 1, 9, 0))).toEqual(new Date(2024, 0, 1, 0, 0, 0, 0));
  });

  it("returns the preceding Monday for a mid-week date", () => {
    expect(startOfLocalWeek(new Date(2024, 0, 3, 15, 30))).toEqual(new Date(2024, 0, 1, 0, 0, 0, 0));
  });

  it("treats Sunday as the end of the week (Monday-first)", () => {
    expect(startOfLocalWeek(new Date(2024, 0, 7, 23, 0))).toEqual(new Date(2024, 0, 1, 0, 0, 0, 0));
  });

  it("crosses month boundaries correctly", () => {
    // 2026-07-01 is a Wednesday; the week's Monday is June 29.
    expect(startOfLocalWeek(new Date(2026, 6, 1, 12, 0))).toEqual(new Date(2026, 5, 29, 0, 0, 0, 0));
  });
});

describe("startOfLocalMonth", () => {
  it("returns the 1st of the month at midnight", () => {
    expect(startOfLocalMonth(new Date(2026, 6, 17, 22, 15))).toEqual(new Date(2026, 6, 1, 0, 0, 0, 0));
  });

  it("returns the same day, zeroed, when already the 1st", () => {
    expect(startOfLocalMonth(new Date(2026, 6, 1, 8, 0))).toEqual(new Date(2026, 6, 1, 0, 0, 0, 0));
  });
});

describe("parseLocalDateInput", () => {
  it("parses a YYYY-MM-DD string as local midnight, not UTC", () => {
    expect(parseLocalDateInput("2026-07-01")).toEqual(new Date(2026, 6, 1, 0, 0, 0, 0));
  });

  it("zero-pads correctly for single-digit months and days", () => {
    expect(parseLocalDateInput("2026-01-05")).toEqual(new Date(2026, 0, 5, 0, 0, 0, 0));
  });
});

describe("resolveDateRange", () => {
  it("'today' resolves to [start of today, start of tomorrow)", () => {
    const now = new Date(2026, 6, 8, 15, 30);
    expect(resolveDateRange("today", { now })).toEqual({
      from: new Date(2026, 6, 8, 0, 0, 0, 0),
      to: new Date(2026, 6, 9, 0, 0, 0, 0),
    });
  });

  it("'week' resolves to [Monday of this week, next Monday)", () => {
    const now = new Date(2024, 0, 3, 15, 30); // Wednesday
    expect(resolveDateRange("week", { now })).toEqual({
      from: new Date(2024, 0, 1, 0, 0, 0, 0),
      to: new Date(2024, 0, 8, 0, 0, 0, 0),
    });
  });

  it("'month' resolves to [1st of this month, 1st of next month)", () => {
    const now = new Date(2026, 6, 17, 9, 0); // July
    expect(resolveDateRange("month", { now })).toEqual({
      from: new Date(2026, 6, 1, 0, 0, 0, 0),
      to: new Date(2026, 7, 1, 0, 0, 0, 0),
    });
  });

  it("'month' crosses a year boundary correctly", () => {
    const now = new Date(2025, 11, 20, 9, 0); // December 2025
    expect(resolveDateRange("month", { now })).toEqual({
      from: new Date(2025, 11, 1, 0, 0, 0, 0),
      to: new Date(2026, 0, 1, 0, 0, 0, 0),
    });
  });

  it("'custom' resolves an inclusive from/to string range to [from, day after to)", () => {
    expect(resolveDateRange("custom", { from: "2026-07-01", to: "2026-07-05" })).toEqual({
      from: new Date(2026, 6, 1, 0, 0, 0, 0),
      to: new Date(2026, 6, 6, 0, 0, 0, 0),
    });
  });

  it("'custom' accepts a single-day range", () => {
    expect(resolveDateRange("custom", { from: "2026-07-01", to: "2026-07-01" })).toEqual({
      from: new Date(2026, 6, 1, 0, 0, 0, 0),
      to: new Date(2026, 6, 2, 0, 0, 0, 0),
    });
  });

  it("'custom' throws when from or to is missing", () => {
    expect(() => resolveDateRange("custom", { from: "2026-07-01" })).toThrow();
    expect(() => resolveDateRange("custom", { to: "2026-07-01" })).toThrow();
    expect(() => resolveDateRange("custom", {})).toThrow();
  });
});
