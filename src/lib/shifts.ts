// Cash-register shift math, shared by the shift routes and tested in isolation.

export type PaymentMethod = "CASH" | "CARD" | "BALANCE";

export const PAYMENT_METHODS: PaymentMethod[] = ["CASH", "CARD", "BALANCE"];

export function isPaymentMethod(value: unknown): value is PaymentMethod {
  return value === "CASH" || value === "CARD" || value === "BALANCE";
}

type Payment = { cost: number; paymentMethod: string | null };

// Cash the drawer should hold: what it opened with plus every cash payment
// recorded during the shift. Card and balance payments never touch the drawer.
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

type BalanceCustomer = { balance: number } | null | undefined;

// Whether a session can be paid from a customer's prepaid balance: there must
// be a customer (a walk-in with no customerId can't pay from balance) and
// their balance must fully cover the cost — no partial payments, no letting
// the balance go negative.
export function canPayFromBalance(customer: BalanceCustomer, cost: number): boolean {
  if (!customer) return false;
  return customer.balance >= cost;
}
