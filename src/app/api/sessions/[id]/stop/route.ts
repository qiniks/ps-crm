import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { openCost } from "@/lib/tariffs";
import { requireMembership } from "@/lib/auth/requireMembership";
import { getSessionUser } from "@/lib/auth/session";
import { isPaymentMethod } from "@/lib/shifts";
import { logAudit } from "@/lib/audit";

// POST /api/sessions/[id]/stop — finish a session and finalize the bill.
// body: { paymentMethod?: "CASH" | "CARD" } — defaults to CASH.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await prisma.session.findUnique({
    where: { id },
    include: { station: { include: { room: true } } },
  });

  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  const auth = await requireMembership(session.tenantId);
  if (!auth.ok) return auth.response;

  if (session.status === "FINISHED") {
    return NextResponse.json({ error: "Session already finished" }, { status: 409 });
  }

  const body = (await req.json().catch(() => ({}))) as { paymentMethod?: string };
  const paymentMethod = body.paymentMethod ?? "CASH";
  if (!isPaymentMethod(paymentMethod)) {
    return NextResponse.json({ error: "invalid paymentMethod" }, { status: 400 });
  }

  const endedAt = new Date();
  const cost =
    session.tariffKind === "OPEN"
      ? openCost(session.startedAt, endedAt, session.station.room.openHourlyRate)
      : session.cost;

  // The payment lands in the club's open shift, if one exists right now.
  const openShift = await prisma.shift.findFirst({
    where: { tenantId: session.tenantId, status: "OPEN" },
    select: { id: true },
  });

  const updated = await prisma.session.update({
    where: { id: session.id },
    data: { endedAt, cost, status: "FINISHED", paymentMethod, shiftId: openShift?.id ?? null },
  });

  await prisma.station.update({
    where: { id: session.stationId },
    data: { status: "FREE" },
  });

  // The real signed-in user, not the impersonated one — an admin browsing as
  // someone else must not have the audit trail attribute the stop to the
  // impersonated identity (same reasoning as the shift-open route).
  const user = await getSessionUser();
  await logAudit({
    tenantId: session.tenantId,
    actorUserId: user?.id ?? auth.userId,
    actorEmail: user?.email ?? null,
    action: "session.stop",
    targetType: "Session",
    targetId: session.id,
    metadata: {
      stationId: session.stationId,
      tariffKind: session.tariffKind,
      cost,
      paymentMethod,
    },
  });

  return NextResponse.json(updated);
}
