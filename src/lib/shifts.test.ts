import { describe, expect, it } from "vitest";
import { cashDifference, expectedCash, isPaymentMethod } from "./shifts";

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
