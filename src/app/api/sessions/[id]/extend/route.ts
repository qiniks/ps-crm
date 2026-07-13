import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { extendSession, tariffHours, type TariffKind } from "@/lib/tariffs";
import { requireMembership } from "@/lib/auth/requireMembership";
import { getSessionUser } from "@/lib/auth/session";
import { logAudit } from "@/lib/audit";

const FIXED_TARIFFS: TariffKind[] = ["HOUR_1", "HOUR_3", "HOUR_5"];

// POST /api/sessions/[id]/extend — add another tariff block to an active
// fixed-tariff session, in place (same session row, no new session created).
// body: { tariffKind: "HOUR_1" | "HOUR_3" | "HOUR_5" }
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

  if (session.status !== "ACTIVE") {
    return NextResponse.json({ error: "Session is not active" }, { status: 409 });
  }
  if (session.tariffKind === "OPEN") {
    return NextResponse.json(
      { error: "Cannot extend an open-tariff session" },
      { status: 400 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as { tariffKind?: string };
  if (!body.tariffKind || !FIXED_TARIFFS.includes(body.tariffKind as TariffKind)) {
    return NextResponse.json({ error: "invalid tariffKind" }, { status: 400 });
  }
  const tariffKind = body.tariffKind as TariffKind;

  // Fixed-tariff sessions always get a plannedEndAt at booking time (see
  // POST /api/sessions); only OPEN sessions omit it, and those are rejected above.
  const { plannedEndAt, cost } = extendSession(
    { plannedEndAt: session.plannedEndAt!, cost: session.cost },
    session.station.room,
    tariffKind
  );

  const updated = await prisma.session.update({
    where: { id: session.id },
    data: { plannedEndAt, cost },
  });

  const user = await getSessionUser();
  await logAudit({
    tenantId: session.tenantId,
    actorUserId: user?.id ?? auth.userId,
    actorEmail: user?.email ?? null,
    action: "session.extend",
    targetType: "Session",
    targetId: session.id,
    metadata: {
      stationId: session.stationId,
      tariffKind,
      addedMinutes: tariffHours(tariffKind)! * 60,
      addedCost: cost - session.cost,
      previousPlannedEndAt: session.plannedEndAt,
      newPlannedEndAt: plannedEndAt,
      previousCost: session.cost,
      newCost: cost,
    },
  });

  return NextResponse.json(updated);
}
