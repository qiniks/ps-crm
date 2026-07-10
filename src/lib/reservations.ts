// Reservation rules shared by the reservation and session-booking routes.
// Only fixed tariffs can be reserved — their duration is known, so overlap
// is computable; an OPEN session has no end time to check against.

import { tariffHours, type TariffKind } from "./tariffs";

export const RESERVABLE_TARIFFS: TariffKind[] = ["HOUR_1", "HOUR_3", "HOUR_5"];

// How far ahead a reservation may start.
export const MAX_ADVANCE_DAYS = 30;

// A walk-in OPEN session (no known end) blocks-and-is-blocked-by reservations
// starting within this window.
export const OPEN_SESSION_BLOCK_MIN = 60;

export type Interval = { startAt: Date; endAt: Date };

export function intervalsOverlap(a: Interval, b: Interval): boolean {
  return a.startAt < b.endAt && b.startAt < a.endAt;
}

// The station-time window a new booking will occupy: the tariff window for
// fixed tariffs, or the OPEN block window when the end is unknown.
export function bookingWindow(startAt: Date, tariffKind: TariffKind): Interval {
  const hours = tariffHours(tariffKind);
  const minutes = hours != null ? hours * 60 : OPEN_SESSION_BLOCK_MIN;
  return { startAt, endAt: new Date(startAt.getTime() + minutes * 60_000) };
}

// First existing reservation that collides with the candidate window, or null.
export function findConflict<T extends Interval>(candidate: Interval, existing: T[]): T | null {
  return existing.find((r) => intervalsOverlap(candidate, r)) ?? null;
}

export type ReservationTimeError = "past" | "too-far";

export function validateReservationStart(startAt: Date, now: Date): ReservationTimeError | null {
  if (startAt.getTime() < now.getTime()) return "past";
  if (startAt.getTime() > now.getTime() + MAX_ADVANCE_DAYS * 86_400_000) return "too-far";
  return null;
}

// Default "imminent" alert window for a reservation's start time.
export const RESERVATION_IMMINENT_MS = 15 * 60_000;

// True if a reservation hasn't started yet, but will within `thresholdMs`.
// Once the start time has passed this returns false — the seat/no-show flow
// handles that case, not this alert.
export function isReservationImminent(
  startAt: Date | string,
  now: Date | number,
  thresholdMs: number = RESERVATION_IMMINENT_MS
): boolean {
  const until = new Date(startAt).getTime() - new Date(now).getTime();
  return until >= 0 && until <= thresholdMs;
}
