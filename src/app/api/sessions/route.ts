import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST /api/sessions — start a session on a station.
// body: { stationId: string, customerId?: string, tariffId?: string }
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { stationId, customerId, tariffId } = body as {
    stationId?: string;
    customerId?: string;
    tariffId?: string;
  };

  if (!stationId) {
    return NextResponse.json({ error: "stationId is required" }, { status: 400 });
  }

  const station = await prisma.station.findUnique({ where: { id: stationId } });
  if (!station) {
    return NextResponse.json({ error: "Station not found" }, { status: 404 });
  }
  if (station.status === "BUSY") {
    return NextResponse.json({ error: "Station is already busy" }, { status: 409 });
  }

  const session = await prisma.session.create({
    data: {
      stationId,
      customerId: customerId || null,
      tariffId: tariffId || null,
      status: "ACTIVE",
    },
  });

  await prisma.station.update({
    where: { id: stationId },
    data: { status: "BUSY" },
  });

  return NextResponse.json(session, { status: 201 });
}
