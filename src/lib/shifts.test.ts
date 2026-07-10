import { describe, expect, it } from "vitest";
import { canPayFromBalance, cashDifference, expectedCash, isPaymentMethod } from "./shifts";

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
