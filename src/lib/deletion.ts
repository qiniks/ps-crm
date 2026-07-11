// Rules for whether a Room or Tenant (club) is safe to remove.
//
// Removal here means a soft archive (an `archivedAt` timestamp — see the
// route handlers), not a hard `prisma.delete`. Both Room and Tenant have
// `onDelete: Cascade` configured down to Station, and from there to Session/
// Reservation (and, for Tenant, Shift) — see prisma/schema.prisma. A hard
// delete would therefore silently wipe historical, already-paid sessions and
// closed shifts along with the row you meant to remove, which is
// unacceptable in a cash-handling app with financial reporting. Archiving
// just hides the row from normal listings while keeping every historical
// record intact for reports.
//
// Regardless of hard-delete vs archive, removal must never happen while
// something is mid-flight: an ACTIVE session (station status BUSY) that
// hasn't been paid for yet, or — for a whole club — a cash-register shift
// that's still open. These pure checks are shared by the room/tenant delete
// routes so the "is this safe" decision is tested without touching Prisma.

export type StationStatus = { status: string };

// True when at least one station is mid-session. BUSY is set exactly when a
// Session is ACTIVE and cleared when it's stopped (see /api/sessions and
// /api/sessions/[id]/stop), so this is equivalent to "has an active session".
export function hasActiveStation(stations: StationStatus[]): boolean {
  return stations.some((s) => s.status === "BUSY");
}

// A room can be archived as long as none of its stations are mid-session.
export function canDeleteRoom(stations: StationStatus[]): boolean {
  return !hasActiveStation(stations);
}

// A club can be archived only when nothing is in progress anywhere in it:
// no station across any of its rooms is mid-session, and its cash-register
// shift (if any) is closed — an open shift means there's a drawer float that
// still needs to be reconciled.
export function canDeleteTenant(params: {
  stations: StationStatus[];
  hasOpenShift: boolean;
}): boolean {
  return !hasActiveStation(params.stations) && !params.hasOpenShift;
}
