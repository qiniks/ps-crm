import { describe, expect, it } from "vitest";
import {
  extendSession,
  fixedPrice,
  isSessionEndingSoon,
  liveCost,
  openCost,
  tariffHours,
} from "./tariffs";

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

describe("extendSession", () => {
  it("pushes plannedEndAt out by the tariff's duration and adds its price to cost", () => {
    const plannedEndAt = new Date(2026, 6, 8, 11, 0);
    const result = extendSession({ plannedEndAt, cost: 150 }, room, "HOUR_1");
    expect(result.plannedEndAt).toEqual(new Date(2026, 6, 8, 12, 0));
    expect(result.cost).toBe(300);
  });

  it("extends from the existing planned end, not from now, so overtime isn't reset", () => {
    const plannedEndAt = new Date(2026, 6, 8, 10, 0);
    const result = extendSession({ plannedEndAt, cost: 400 }, room, "HOUR_3");
    expect(result.plannedEndAt).toEqual(new Date(2026, 6, 8, 13, 0));
    expect(result.cost).toBe(800);
  });

  it("accepts a plannedEndAt string, same as the API DTOs use", () => {
    const result = extendSession(
      { plannedEndAt: "2026-07-08T10:00:00.000Z", cost: 600 },
      room,
      "HOUR_5"
    );
    expect(result.plannedEndAt).toEqual(new Date("2026-07-08T15:00:00.000Z"));
    expect(result.cost).toBe(1200);
  });

  it("throws for OPEN since it has no plannedEndAt to push out", () => {
    const plannedEndAt = new Date(2026, 6, 8, 11, 0);
    expect(() => extendSession({ plannedEndAt, cost: 0 }, room, "OPEN")).toThrow();
  });
});

describe("isSessionEndingSoon", () => {
  const plannedEndAt = new Date(2026, 6, 8, 12, 0);

  it("is false when well before the planned end", () => {
    const now = new Date(2026, 6, 8, 11, 0);
    expect(isSessionEndingSoon(plannedEndAt, now, 5 * 60_000)).toBe(false);
  });

  it("is true within the threshold before the planned end", () => {
    const now = new Date(2026, 6, 8, 11, 57);
    expect(isSessionEndingSoon(plannedEndAt, now, 5 * 60_000)).toBe(true);
  });

  it("is true exactly at the threshold boundary", () => {
    const now = new Date(2026, 6, 8, 11, 55);
    expect(isSessionEndingSoon(plannedEndAt, now, 5 * 60_000)).toBe(true);
  });

  it("is true exactly at the planned end (still not overtime)", () => {
    expect(isSessionEndingSoon(plannedEndAt, plannedEndAt, 5 * 60_000)).toBe(true);
  });

  it("is false once the session is already overtime", () => {
    const now = new Date(2026, 6, 8, 12, 1);
    expect(isSessionEndingSoon(plannedEndAt, now, 5 * 60_000)).toBe(false);
  });

  it("accepts a plannedEndAt string and a now timestamp, same as the API DTOs use", () => {
    const end = "2026-07-08T12:00:00.000Z";
    const now = new Date("2026-07-08T11:58:00.000Z").getTime();
    expect(isSessionEndingSoon(end, now, 5 * 60_000)).toBe(true);
  });
});
