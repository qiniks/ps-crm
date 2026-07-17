import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMembership } from "@/lib/auth/requireMembership";
import { getSessionUser } from "@/lib/auth/session";
import { cashDifference, expectedCash, paymentMethodBreakdown } from "@/lib/shifts";
import { logAudit, shiftCloseMetadata } from "@/lib/audit";

// POST /api/shifts/[shiftId]/close — close a shift with the counted cash.
// body: { closingCash }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ shiftId: string }> }
) {
  const { shiftId } = await params;
  const shift = await prisma.shift.findUnique({
    where: { id: shiftId },
    include: {
      sessions: { select: { cost: true, paymentMethod: true } },
      sales: { select: { cost: true, paymentMethod: true } },
    },
  });
  if (!shift) return NextResponse.json({ error: "Shift not found" }, { status: 404 });

  const auth = await requireMembership(shift.tenantId);
  if (!auth.ok) return auth.response;

  if (shift.status === "CLOSED") {
    return NextResponse.json({ error: "Shift already closed" }, { status: 409 });
  }

  const body = (await req.json().catch(() => ({}))) as { closingCash?: number };
  const closingCash = Math.round(Number(body.closingCash));
  if (!Number.isFinite(closingCash) || closingCash < 0) {
    return NextResponse.json({ error: "invalid closingCash" }, { status: 400 });
  }

  const updated = await prisma.shift.update({
    where: { id: shift.id },
    data: { status: "CLOSED", closedAt: new Date(), closingCash },
  });

  const payments = [...shift.sessions, ...shift.sales];
  const expected = expectedCash(shift.openingCash, payments);

  // The real signed-in user, not the impersonated one — same reasoning as
  // the shift-open route: whoever counted the drawer is who the audit trail
  // should name.
  const user = await getSessionUser();
  await logAudit({
    tenantId: shift.tenantId,
    actorUserId: user?.id ?? auth.userId,
    actorEmail: user?.email ?? shift.openedBy ?? null,
    action: "shift.close",
    targetType: "Shift",
    targetId: shift.id,
    metadata: shiftCloseMetadata({
      openingCash: shift.openingCash,
      closingCash,
      expectedCash: expected,
    }),
  });

  return NextResponse.json({
    ...updated,
    expectedCash: expected,
    difference: cashDifference(expected, closingCash),
    paymentBreakdown: paymentMethodBreakdown(payments),
    sessionsCount: shift.sessions.length,
  });
}
