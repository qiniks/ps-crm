import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { openCost } from "@/lib/tariffs";
import { requireMembership } from "@/lib/auth/requireMembership";

// POST /api/sessions/[id]/stop — finish a session and finalize the bill.
export async function POST(
  _req: NextRequest,
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

  const endedAt = new Date();
  const cost =
    session.tariffKind === "OPEN"
      ? openCost(session.startedAt, endedAt, session.station.room.openHourlyRate)
      : session.cost;

  const updated = await prisma.session.update({
    where: { id: session.id },
    data: { endedAt, cost, status: "FINISHED" },
  });

  await prisma.station.update({
    where: { id: session.stationId },
    data: { status: "FREE" },
  });

  return NextResponse.json(updated);
}
