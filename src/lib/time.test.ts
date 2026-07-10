import { describe, expect, it } from "vitest";
import { localDayKey, startOfLocalDay, startOfLocalDayDaysAgo } from "./time";

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
