import { describe, expect, it } from "vitest";
import { fixedPrice, liveCost, openCost, tariffHours } from "./tariffs";

const room = { price1h: 150, price3h: 400, price5h: 600, openHourlyRate: 150 };

describe("fixedPrice", () => {
  it("returns the room's price for each fixed tariff", () => {
    expect(fixedPrice(room, "HOUR_1")).toBe(150);
    expect(fixedPrice(room, "HOUR_3")).toBe(400);
    expect(fixedPrice(room, "HOUR_5")).toBe(600);
  });

  it("returns null for OPEN (billed on stop, not up-front)", () => {
    expect(fixedPrice(room, "OPEN")).toBeNull();
  });
});

describe("tariffHours", () => {
  it("returns the duration for fixed tariffs and null for OPEN", () => {
    expect(tariffHours("HOUR_1")).toBe(1);
    expect(tariffHours("HOUR_3")).toBe(3);
    expect(tariffHours("HOUR_5")).toBe(5);
    expect(tariffHours("OPEN")).toBeNull();
  });
});

describe("openCost", () => {
  it("charges elapsed hours at the room's hourly rate", () => {
    const start = new Date(2026, 6, 8, 10, 0);
    const end = new Date(2026, 6, 8, 12, 0);
    expect(openCost(start, end, 150)).toBe(300);
  });

  it("rounds to the nearest whole unit for partial hours", () => {
    const start = new Date(2026, 6, 8, 10, 0);
    const end = new Date(2026, 6, 8, 10, 40); // 2/3 hour
    expect(openCost(start, end, 150)).toBe(100);
  });

  it("is zero when stopped immediately", () => {
    const start = new Date(2026, 6, 8, 10, 0);
    expect(openCost(start, start, 150)).toBe(0);
  });
});

describe("liveCost", () => {
  it("matches the room's fixed price for a fixed tariff, regardless of elapsed time", () => {
    const startedAt = new Date(2026, 6, 8, 10, 0);
    const now = new Date(2026, 6, 8, 10, 5);
    expect(liveCost({ tariffKind: "HOUR_1", startedAt }, room, now)).toBe(150);
    expect(liveCost({ tariffKind: "HOUR_3", startedAt }, room, now)).toBe(400);
  });

  it("matches openCost for an OPEN tariff", () => {
    const startedAt = new Date(2026, 6, 8, 10, 0);
    const now = new Date(2026, 6, 8, 11, 30);
    expect(liveCost({ tariffKind: "OPEN", startedAt }, room, now)).toBe(
      openCost(startedAt, now, room.openHourlyRate)
    );
  });

  it("accepts a startedAt string and a now timestamp, same as the API DTOs use", () => {
    const startedAt = "2026-07-08T10:00:00.000Z";
    const now = new Date("2026-07-08T11:00:00.000Z").getTime();
    expect(liveCost({ tariffKind: "OPEN", startedAt }, room, now)).toBe(150);
  });
});
