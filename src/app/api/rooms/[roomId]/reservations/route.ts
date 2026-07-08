import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMembership } from "@/lib/auth/requireMembership";
import { tariffHours, type TariffKind } from "@/lib/tariffs";
import {
  RESERVABLE_TARIFFS,
  bookingWindow,
  findConflict,
  validateReservationStart,
} from "@/lib/reservations";

export const dynamic = "force-dynamic";

// GET /api/rooms/[roomId]/reservations — upcoming (not yet finished) booked
// reservations for the room, soonest first.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  const room = await prisma.room.findUnique({ where: { id: roomId } });
  if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

  const auth = await requireMembership(room.tenantId);
  if (!auth.ok) return auth.response;

  const reservations = await prisma.reservation.findMany({
    where: { station: { roomId }, status: "BOOKED", endAt: { gte: new Date() } },
    orderBy: { startAt: "asc" },
    take: 50,
    include: {
      station: { select: { id: true, name: true } },
      customer: { select: { name: true } },
    },
  });

  return NextResponse.json(
    reservations.map((r) => ({
      id: r.id,
      stationId: r.station.id,
      stationName: r.station.name,
      tariffKind: r.tariffKind,
      startAt: r.startAt,
      endAt: r.endAt,
      name: r.customer?.name ?? r.guestName ?? null,
    }))
  );
}

// POST /api/rooms/[roomId]/reservations — reserve a station for a future time.
// body: { stationId, tariffKind, startAt, customerId?, guestName? }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    stationId?: string;
    tariffKind?: TariffKind;
    startAt?: string;
    customerId?: string;
    guestName?: string;
  };

  if (!body.stationId) {
    return NextResponse.json({ error: "stationId is required" }, { status: 400 });
  }
  if (!body.tariffKind || !RESERVABLE_TARIFFS.includes(body.tariffKind)) {
    return NextResponse.json({ error: "invalid tariffKind" }, { status: 400 });
  }
  const startAt = body.startAt ? new Date(body.startAt) : null;
  if (!startAt || Number.isNaN(startAt.getTime())) {
    return NextResponse.json({ error: "invalid startAt" }, { status: 400 });
  }

  const station = await prisma.station.findUnique({ where: { id: body.stationId } });
  if (!station || station.roomId !== roomId) {
    return NextResponse.json({ error: "Station not found" }, { status: 404 });
  }

  const auth = await requireMembership(station.tenantId);
  if (!auth.ok) return auth.response;

  const timeError = validateReservationStart(startAt, new Date());
  if (timeError) {
    return NextResponse.json({ error: `startAt is ${timeError}` }, { status: 400 });
  }

  const hours = tariffHours(body.tariffKind)!;
  const window = bookingWindow(startAt, body.tariffKind);

  const existing = await prisma.reservation.findMany({
    where: { stationId: station.id, status: "BOOKED", endAt: { gte: new Date() } },
    select: { id: true, startAt: true, endAt: true },
  });
  const conflict = findConflict(window, existing);
  if (conflict) {
    return NextResponse.json(
      { error: "reservation-conflict", conflictStartAt: conflict.startAt },
      { status: 409 }
    );
  }

  const reservation = await prisma.reservation.create({
    data: {
      tenantId: station.tenantId,
      stationId: station.id,
      customerId: body.customerId || null,
      guestName: body.guestName?.trim() || null,
      tariffKind: body.tariffKind,
      startAt,
      endAt: new Date(startAt.getTime() + hours * 3_600_000),
    },
  });

  return NextResponse.json(reservation, { status: 201 });
}
