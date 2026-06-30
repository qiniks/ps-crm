import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeCost } from "@/lib/format";

// POST /api/sessions/[id]/stop — finish a session and bill it.
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await prisma.session.findUnique({
    where: { id: params.id },
    include: { station: true, tariff: true },
  });

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
  if (session.status === "FINISHED") {
    return NextResponse.json({ error: "Session already finished" }, { status: 409 });
  }

  const endedAt = new Date();
  const rate = session.tariff?.pricePerHour ?? session.station.hourlyRate;
  const cost = computeCost(session.startedAt, endedAt, rate);

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
