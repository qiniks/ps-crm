import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fixedPrice, tariffHours, type TariffKind } from "@/lib/tariffs";
import { requireMembership } from "@/lib/auth/requireMembership";
import { bookingWindow, findConflict } from "@/lib/reservations";

const VALID: TariffKind[] = ["HOUR_1", "HOUR_3", "HOUR_5", "OPEN"];

// POST /api/sessions — book a station.
// body: { stationId, tariffKind, customerId? }
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    stationId?: string;
    tariffKind?: TariffKind;
    customerId?: string;
  };

  if (!body.stationId) {
    return NextResponse.json({ error: "stationId is required" }, { status: 400 });
  }
  if (!body.tariffKind || !VALID.includes(body.tariffKind)) {
    return NextResponse.json({ error: "invalid tariffKind" }, { status: 400 });
  }

  const station = await prisma.station.findUnique({
    where: { id: body.stationId },
    include: { room: true },
  });
  if (!station) return NextResponse.json({ error: "Station not found" }, { status: 404 });

  const auth = await requireMembership(station.tenantId);
  if (!auth.ok) return auth.response;

  if (station.status === "BUSY") {
    return NextResponse.json({ error: "Station is already busy" }, { status: 409 });
  }

  const now = new Date();

  // A walk-in must not run into an upcoming reservation on this station.
  const upcoming = await prisma.reservation.findMany({
    where: { stationId: station.id, status: "BOOKED", endAt: { gte: now } },
    select: { startAt: true, endAt: true },
  });
  const conflict = findConflict(bookingWindow(now, body.tariffKind), upcoming);
  if (conflict) {
    return NextResponse.json(
      { error: "reservation-conflict", conflictStartAt: conflict.startAt },
      { status: 409 }
    );
  }

  const hours = tariffHours(body.tariffKind);
  const plannedEndAt = hours != null ? new Date(now.getTime() + hours * 3_600_000) : null;
  // Fixed tariffs are charged up-front; OPEN is billed on stop.
  const cost = fixedPrice(station.room, body.tariffKind) ?? 0;

  const session = await prisma.session.create({
    data: {
      tenantId: station.tenantId,
      stationId: station.id,
      customerId: body.customerId || null,
      tariffKind: body.tariffKind,
      startedAt: now,
      plannedEndAt,
      cost,
      status: "ACTIVE",
    },
  });

  await prisma.station.update({
    where: { id: station.id },
    data: { status: "BUSY" },
  });

  return NextResponse.json(session, { status: 201 });
}
