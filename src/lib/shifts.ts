// Cash-register shift math, shared by the shift routes and tested in isolation.

export type PaymentMethod = "CASH" | "CARD";

export const PAYMENT_METHODS: PaymentMethod[] = ["CASH", "CARD"];

export function isPaymentMethod(value: unknown): value is PaymentMethod {
  return value === "CASH" || value === "CARD";
}

type Payment = { cost: number; paymentMethod: string | null };

// Cash the drawer should hold: what it opened with plus every cash payment
// recorded during the shift. Card payments never touch the drawer.
export function expectedCash(openingCash: number, payments: Payment[]): number {
  return (
    openingCash +
    payments.reduce((sum, p) => (p.paymentMethod === "CASH" ? sum + p.cost : sum), 0)
  );
}

// Positive = surplus in the drawer, negative = shortage.
export function cashDifference(expected: number, countedCash: number): number {
  return countedCash - expected;
}
