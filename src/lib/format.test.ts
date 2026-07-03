import { describe, expect, it } from "vitest";
import { computeCost, formatDuration, formatMoney } from "./format";

describe("formatMoney", () => {
  it("groups thousands using the ru-RU locale", () => {
    // Intl's exact thousands-separator character varies by ICU data (regular vs.
    // narrow no-break space) — normalize all whitespace before comparing so this
    // test doesn't depend on which one the running Node build ships.
    const result = formatMoney(1234567).replace(/\s/g, " ");
    expect(result).toBe("1 234 567");
  });
});

describe("formatDuration", () => {
  it("formats milliseconds as H:MM:SS", () => {
    expect(formatDuration(3_725_000)).toBe("1:02:05"); // 1h 2m 5s
  });

  it("clamps negative durations to zero instead of going negative", () => {
    expect(formatDuration(-5000)).toBe("0:00:00");
  });
});

describe("computeCost", () => {
  it("computes cost from elapsed hours times the hourly rate, rounded", () => {
    const start = new Date("2026-01-01T10:00:00Z");
    const end = new Date("2026-01-01T11:30:00Z"); // 1.5 hours elapsed
    expect(computeCost(start, end, 200)).toBe(300); // 1.5 * 200
  });
});
