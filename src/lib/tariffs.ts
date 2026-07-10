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

// Final cost of an OPEN session from elapsed time and the room's hourly rate.
export function openCost(startedAt: Date, endedAt: Date, openHourlyRate: number): number {
  const hours = (endedAt.getTime() - startedAt.getTime()) / 3_600_000;
  return Math.round(hours * openHourlyRate);
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
