import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMembership } from "@/lib/auth/requireMembership";
import { canDeleteTenant } from "@/lib/deletion";

export const dynamic = "force-dynamic";

// DELETE /api/clubs/[clubId] — archive a club (soft delete).
// Tenant→everything cascades (Room, Station, Session, Reservation, Shift,
// Membership — see prisma/schema.prisma), so a hard delete would wipe every
// historical, already-reconciled session and shift for the club. We set
// archivedAt instead: the club drops out of /api/clubs listings (so members
// stop seeing it day to day) but every row survives for reporting, and the
// admin panel can still see/restore it since it reads Tenant directly.
// Blocked outright while anything is in progress: any station across any
// room is mid-session (BUSY, i.e. an unpaid ACTIVE session), or a
// cash-register shift is still open with an unreconciled cash float.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ clubId: string }> }
) {
  const { clubId } = await params;
  const auth = await requireMembership(clubId);
  if (!auth.ok) return auth.response;

  const tenant = await prisma.tenant.findUnique({ where: { id: clubId } });
  if (!tenant) return NextResponse.json({ error: "Club not found" }, { status: 404 });

  if (tenant.archivedAt) {
    return NextResponse.json({ ok: true, archived: true });
  }

  const [stations, openShift] = await Promise.all([
    prisma.station.findMany({ where: { tenantId: clubId }, select: { status: true } }),
    prisma.shift.findFirst({ where: { tenantId: clubId, status: "OPEN" }, select: { id: true } }),
  ]);

  if (!canDeleteTenant({ stations, hasOpenShift: !!openShift })) {
    return NextResponse.json(
      {
        error: openShift ? "club-has-open-shift" : "club-has-active-session",
      },
      { status: 409 }
    );
  }

  await prisma.tenant.update({ where: { id: clubId }, data: { archivedAt: new Date() } });
  return NextResponse.json({ ok: true, archived: true });
}
