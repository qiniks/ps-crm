import { describe, expect, it } from "vitest";
import {
  bookingWindow,
  findConflict,
  intervalsOverlap,
  validateReservationStart,
} from "./reservations";

const at = (h: number, m = 0) => new Date(2026, 6, 8, h, m);

describe("intervalsOverlap", () => {
  it("detects partial and containing overlaps", () => {
    expect(
      intervalsOverlap({ startAt: at(10), endAt: at(12) }, { startAt: at(11), endAt: at(13) })
    ).toBe(true);
    expect(
      intervalsOverlap({ startAt: at(10), endAt: at(14) }, { startAt: at(11), endAt: at(12) })
    ).toBe(true);
  });

  it("treats touching intervals as non-overlapping", () => {
    expect(
      intervalsOverlap({ startAt: at(10), endAt: at(12) }, { startAt: at(12), endAt: at(13) })
    ).toBe(false);
  });
});

describe("bookingWindow", () => {
  it("uses the tariff duration for fixed tariffs", () => {
    const w = bookingWindow(at(18), "HOUR_3");
    expect(w.endAt).toEqual(at(21));
  });

  it("uses the 60-minute block for OPEN sessions", () => {
    const w = bookingWindow(at(18), "OPEN");
    expect(w.endAt).toEqual(at(19));
  });
});

describe("findConflict", () => {
  const existing = [
    { startAt: at(12), endAt: at(13), id: "a" },
    { startAt: at(19), endAt: at(22), id: "b" },
  ];

  it("returns the colliding reservation", () => {
    expect(findConflict(bookingWindow(at(18), "HOUR_3"), existing)?.id).toBe("b");
  });

  it("returns null when the window is free", () => {
    expect(findConflict(bookingWindow(at(13), "HOUR_5"), existing)).toBeNull();
  });
});

describe("validateReservationStart", () => {
  const now = at(10);

  it("rejects past starts", () => {
    expect(validateReservationStart(at(9, 59), now)).toBe("past");
  });

  it("rejects starts beyond the advance window", () => {
    const tooFar = new Date(now.getTime() + 31 * 86_400_000);
    expect(validateReservationStart(tooFar, now)).toBe("too-far");
  });

  it("accepts a valid future start", () => {
    expect(validateReservationStart(at(18), now)).toBeNull();
  });
});
