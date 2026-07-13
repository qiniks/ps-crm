// Tariff definitions shared by client and server.
// Fixed-duration tariffs (1/3/5 hours) plus an OPEN "until the client is done" tariff.

export type TariffKind = "HOUR_1" | "HOUR_3" | "HOUR_5" | "OPEN";

export const TARIFFS: { kind: TariffKind; hours: number | null }[] = [
  { kind: "HOUR_1", hours: 1 },
  { kind: "HOUR_3", hours: 3 },
  { kind: "HOUR_5", hours: 5 },
  { kind: "OPEN", hours: null },
];

type RoomPricing = {
  price1h: number;
  price3h: number;
  price5h: number;
  openHourlyRate: number;
};

// Price to charge up-front for a fixed tariff. Returns null for OPEN (billed on stop).
export function fixedPrice(room: RoomPricing, kind: TariffKind): number | null {
  switch (kind) {
    case "HOUR_1":
      return room.price1h;
    case "HOUR_3":
      return room.price3h;
    case "HOUR_5":
      return room.price5h;
    case "OPEN":
      return null;
  }
}

export function tariffHours(kind: TariffKind): number | null {
  return TARIFFS.find((t) => t.kind === kind)?.hours ?? null;
}

// Default "ending soon" alert window for a fixed-tariff session.
export const SESSION_ENDING_SOON_MS = 5 * 60_000;

// True if a fixed-tariff session hasn't reached its planned end yet, but will
// within `thresholdMs`. Once the session is already overtime (remaining < 0)
// this returns false — that state gets its own distinct treatment.
export function isSessionEndingSoon(
  plannedEndAt: Date | string,
  now: Date | number,
  thresholdMs: number = SESSION_ENDING_SOON_MS
): boolean {
  const remaining = new Date(plannedEndAt).getTime() - new Date(now).getTime();
  return remaining >= 0 && remaining <= thresholdMs;
}

// Final cost of an OPEN session from elapsed time and the room's hourly rate.
export function openCost(startedAt: Date, endedAt: Date, openHourlyRate: number): number {
  const hours = (endedAt.getTime() - startedAt.getTime()) / 3_600_000;
  return Math.round(hours * openHourlyRate);
}

// New plannedEndAt/cost after extending an active fixed-tariff session by
// another tariff block: pushes plannedEndAt out by the tariff's duration
// (from the existing planned end, not from now — an overtime session gets
// its overtime absorbed into the extension rather than restarting the clock)
// and adds the tariff's up-front price to the running cost. Throws for OPEN
// since it has no plannedEndAt to push out; callers validate tariffKind
// against the fixed set at the API boundary before reaching this.
export function extendSession(
  session: { plannedEndAt: Date | string; cost: number },
  room: RoomPricing,
  tariffKind: TariffKind
): { plannedEndAt: Date; cost: number } {
  const hours = tariffHours(tariffKind);
  const price = fixedPrice(room, tariffKind);
  if (hours == null || price == null) {
    throw new Error(`cannot extend a session with tariff ${tariffKind}`);
  }
  return {
    plannedEndAt: new Date(new Date(session.plannedEndAt).getTime() + hours * 3_600_000),
    cost: session.cost + price,
  };
}

// Cost of a session if it were stopped right now: the up-front fixed price
// for fixed tariffs, or elapsed time * hourly rate for OPEN. Shared by every
// place that shows a live/running cost (floor plan, stop dialog) so they
// can't drift from what the stop endpoint actually charges.
export function liveCost(
  session: { tariffKind: TariffKind; startedAt: Date | string },
  room: RoomPricing,
  now: Date | number
): number {
  if (session.tariffKind === "OPEN") {
    return openCost(new Date(session.startedAt), new Date(now), room.openHourlyRate);
  }
  return fixedPrice(room, session.tariffKind) ?? 0;
}
