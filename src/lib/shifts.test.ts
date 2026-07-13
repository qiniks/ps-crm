import { describe, expect, it } from "vitest";
import {
  canPayFromBalance,
  cashDifference,
  expectedCash,
  isPaymentMethod,
  isShiftOpenTooLong,
  paymentMethodBreakdown,
} from "./shifts";

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

  it("does not count balance payments toward the cash drawer", () => {
    const payments = [
      { cost: 500, paymentMethod: "CASH" },
      { cost: 400, paymentMethod: "BALANCE" },
    ];
    expect(expectedCash(1000, payments)).toBe(1500);
  });
});

describe("paymentMethodBreakdown", () => {
  it("sums cost and counts sessions per payment method", () => {
    const payments = [
      { cost: 500, paymentMethod: "CASH" },
      { cost: 300, paymentMethod: "CARD" },
      { cost: 200, paymentMethod: "CASH" },
      { cost: 400, paymentMethod: "BALANCE" },
    ];
    expect(paymentMethodBreakdown(payments)).toEqual({
      CASH: { count: 2, total: 700 },
      CARD: { count: 1, total: 300 },
      BALANCE: { count: 1, total: 400 },
    });
  });

  it("returns zeroed entries for every method when there are no payments", () => {
    expect(paymentMethodBreakdown([])).toEqual({
      CASH: { count: 0, total: 0 },
      CARD: { count: 0, total: 0 },
      BALANCE: { count: 0, total: 0 },
    });
  });

  it("ignores payments with a null or unrecognized payment method", () => {
    const payments = [
      { cost: 500, paymentMethod: "CASH" },
      { cost: 150, paymentMethod: null },
      { cost: 999, paymentMethod: "BITCOIN" },
    ];
    expect(paymentMethodBreakdown(payments)).toEqual({
      CASH: { count: 1, total: 500 },
      CARD: { count: 0, total: 0 },
      BALANCE: { count: 0, total: 0 },
    });
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
  it("accepts CASH, CARD and BALANCE", () => {
    expect(isPaymentMethod("CASH")).toBe(true);
    expect(isPaymentMethod("CARD")).toBe(true);
    expect(isPaymentMethod("BALANCE")).toBe(true);
    expect(isPaymentMethod("BITCOIN")).toBe(false);
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

describe("canPayFromBalance", () => {
  it("rejects when there is no customer", () => {
    expect(canPayFromBalance(null, 500)).toBe(false);
  });

  it("rejects when the balance is less than the cost", () => {
    expect(canPayFromBalance({ balance: 499 }, 500)).toBe(false);
  });

  it("accepts when the balance exactly covers the cost", () => {
    expect(canPayFromBalance({ balance: 500 }, 500)).toBe(true);
  });

  it("accepts when the balance exceeds the cost", () => {
    expect(canPayFromBalance({ balance: 1000 }, 500)).toBe(true);
  });

  it("accepts a zero-cost session regardless of balance", () => {
    expect(canPayFromBalance({ balance: 0 }, 0)).toBe(true);
  });
});
