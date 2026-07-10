import { describe, expect, it } from "vitest";
import { cashDifference, expectedCash, isPaymentMethod, isShiftOpenTooLong } from "./shifts";

describe("expectedCash", () => {
  it("adds only cash payments to the opening float", () => {
    const payments = [
      { cost: 500, paymentMethod: "CASH" },
      { cost: 300, paymentMethod: "CARD" },
      { cost: 200, paymentMethod: "CASH" },
      { cost: 150, paymentMethod: null },
    ];
    expect(expectedCash(1000, payments)).toBe(1700);
  });

  it("returns the opening float when there are no payments", () => {
    expect(expectedCash(500, [])).toBe(500);
  });
});

describe("cashDifference", () => {
  it("is negative on shortage and positive on surplus", () => {
    expect(cashDifference(1700, 1500)).toBe(-200);
    expect(cashDifference(1700, 1800)).toBe(100);
    expect(cashDifference(1700, 1700)).toBe(0);
  });
});

describe("isPaymentMethod", () => {
  it("accepts only CASH and CARD", () => {
    expect(isPaymentMethod("CASH")).toBe(true);
    expect(isPaymentMethod("CARD")).toBe(true);
    expect(isPaymentMethod("BALANCE")).toBe(false);
    expect(isPaymentMethod(undefined)).toBe(false);
  });
});

describe("isShiftOpenTooLong", () => {
  const openedAt = new Date(2026, 6, 8, 8, 0);
  const twelveHours = 12 * 60 * 60_000;

  it("is false when open for less than the threshold", () => {
    const now = new Date(2026, 6, 8, 15, 0); // 7h in
    expect(isShiftOpenTooLong(openedAt, now, twelveHours)).toBe(false);
  });

  it("is true exactly at the threshold", () => {
    const now = new Date(openedAt.getTime() + twelveHours);
    expect(isShiftOpenTooLong(openedAt, now, twelveHours)).toBe(true);
  });

  it("is true well past the threshold", () => {
    const now = new Date(2026, 6, 9, 21, 0); // 37h in
    expect(isShiftOpenTooLong(openedAt, now, twelveHours)).toBe(true);
  });

  it("accepts an openedAt string and a now timestamp, same as the API DTOs use", () => {
    const opened = "2026-07-08T08:00:00.000Z";
    const now = new Date("2026-07-08T21:00:00.000Z").getTime(); // 13h in
    expect(isShiftOpenTooLong(opened, now, twelveHours)).toBe(true);
  });
});
