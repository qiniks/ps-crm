import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMembership } from "@/lib/auth/requireMembership";
import { fixedPrice, tariffHours, type TariffKind } from "@/lib/tariffs";

// PATCH /api/reservations/[id] — body: { action: "cancel" | "seat" }.
// cancel: mark the reservation cancelled.
// seat: the guest arrived — start a real session on the station now.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { action?: string };
  if (body.action !== "cancel" && body.action !== "seat") {
    return NextResponse.json({ error: "invalid action" }, { status: 400 });
  }

  const reservation = await prisma.reservation.findUnique({
    where: { id },
    include: { station: { include: { room: true } } },
  });
  if (!reservation) return NextResponse.json({ error: "Reservation not found" }, { status: 404 });

  const auth = await requireMembership(reservation.tenantId);
  if (!auth.ok) return auth.response;

  if (reservation.status !== "BOOKED") {
    return NextResponse.json({ error: "Reservation is not active" }, { status: 409 });
  }

  if (body.action === "cancel") {
    const updated = await prisma.reservation.update({
      where: { id: reservation.id },
      data: { status: "CANCELLED" },
    });
    return NextResponse.json(updated);
  }

  // seat
  if (reservation.station.status === "BUSY") {
    return NextResponse.json({ error: "Station is already busy" }, { status: 409 });
  }

  const now = new Date();
  const kind = reservation.tariffKind as TariffKind;
  const hours = tariffHours(kind)!;

  const session = await prisma.session.create({
    data: {
      tenantId: reservation.tenantId,
      stationId: reservation.stationId,
      customerId: reservation.customerId,
      tariffKind: kind,
      startedAt: now,
      plannedEndAt: new Date(now.getTime() + hours * 3_600_000),
      cost: fixedPrice(reservation.station.room, kind) ?? 0,
      status: "ACTIVE",
    },
  });

  await prisma.$transaction([
    prisma.station.update({ where: { id: reservation.stationId }, data: { status: "BUSY" } }),
    prisma.reservation.update({ where: { id: reservation.id }, data: { status: "SEATED" } }),
  ]);

  return NextResponse.json(session, { status: 201 });
}
