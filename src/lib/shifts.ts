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

// Default "open too long" alert window for a cash-register shift.
export const SHIFT_OPEN_TOO_LONG_MS = 12 * 60 * 60_000;

// True if a shift opened at `openedAt` has been open for at least
// `thresholdMs` as of `now`. Callers only call this for shifts that are
// still OPEN — a closed shift's duration isn't an ongoing alert.
export function isShiftOpenTooLong(
  openedAt: Date | string,
  now: Date | number,
  thresholdMs: number = SHIFT_OPEN_TOO_LONG_MS
): boolean {
  return new Date(now).getTime() - new Date(openedAt).getTime() >= thresholdMs;
}
