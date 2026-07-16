import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMembership } from "@/lib/auth/requireMembership";
import { canDeleteRoom } from "@/lib/deletion";
import { getSessionUser } from "@/lib/auth/session";
import { logAudit } from "@/lib/audit";
import { isRoomCanvasSize } from "@/lib/room-types";

export const dynamic = "force-dynamic";

// GET /api/rooms/[roomId] — room details, pricing, stations and their active session.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    include: {
      tenant: true,
      stations: {
        orderBy: { name: "asc" },
        include: {
          sessions: {
            where: { status: "ACTIVE" },
            include: { customer: true },
            take: 1,
          },
        },
      },
    },
  });

  if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

  const auth = await requireMembership(room.tenantId);
  if (!auth.ok) return auth.response;

  return NextResponse.json({
    id: room.id,
    name: room.name,
    club: { id: room.tenant.id, name: room.tenant.name },
    price1h: room.price1h,
    price3h: room.price3h,
    price5h: room.price5h,
    openHourlyRate: room.openHourlyRate,
    canvasSize: isRoomCanvasSize(room.canvasSize) ? room.canvasSize : "MEDIUM",
    stations: room.stations.map((s) => {
      const sess = s.sessions[0];
      return {
        id: s.id,
        name: s.name,
        type: s.type,
        status: s.status,
        posX: s.posX,
        posY: s.posY,
        activeSession: sess
          ? {
              id: sess.id,
              tariffKind: sess.tariffKind,
              startedAt: sess.startedAt,
              plannedEndAt: sess.plannedEndAt,
              cost: sess.cost,
              customerId: sess.customerId,
              customerName: sess.customer?.name ?? null,
              customerBalance: sess.customer?.balance ?? null,
            }
          : null,
      };
    }),
  });
}

// PATCH /api/rooms/[roomId] — rename / update per-room pricing.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  const room = await prisma.room.findUnique({ where: { id: roomId } });
  if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

  const auth = await requireMembership(room.tenantId);
  if (!auth.ok) return auth.response;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const num = (v: unknown) => Math.max(0, Math.round(Number(v) || 0));

  const data: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
  if (body.price1h !== undefined) data.price1h = num(body.price1h);
  if (body.price3h !== undefined) data.price3h = num(body.price3h);
  if (body.price5h !== undefined) data.price5h = num(body.price5h);
  if (body.openHourlyRate !== undefined) data.openHourlyRate = num(body.openHourlyRate);
  if (isRoomCanvasSize(body.canvasSize)) data.canvasSize = body.canvasSize;
  // Restore path for an archived room — the only way `archived` is honored
  // here is to un-archive; archiving itself goes through DELETE below so it
  // gets the canDeleteRoom guard.
  if (body.archived === false) data.archivedAt = null;

  const updated = await prisma.room.update({ where: { id: roomId }, data });

  const pricingChanged = ["price1h", "price3h", "price5h", "openHourlyRate"].some(
    (key) => key in data
  );
  if (pricingChanged) {
    const user = await getSessionUser();
    await logAudit({
      tenantId: room.tenantId,
      actorUserId: user?.id ?? auth.userId,
      actorEmail: user?.email ?? null,
      action: "room.updatePricing",
      targetType: "Room",
      targetId: room.id,
      metadata: {
        before: {
          price1h: room.price1h,
          price3h: room.price3h,
          price5h: room.price5h,
          openHourlyRate: room.openHourlyRate,
        },
        after: {
          price1h: updated.price1h,
          price3h: updated.price3h,
          price5h: updated.price5h,
          openHourlyRate: updated.openHourlyRate,
        },
      },
    });
  }

  return NextResponse.json(updated);
}

// DELETE /api/rooms/[roomId] — archive a room (soft delete).
// Room→Station cascades to Session/Reservation (see prisma/schema.prisma),
// so a hard delete would wipe that room's play history; we set archivedAt
// instead and hide it from the normal room list. Blocked outright while any
// of its stations is mid-session (BUSY) — that means real money is on the
// table for an unfinished session, so we refuse rather than silently orphan
// it. Idempotent: archiving an already-archived room just returns it as-is.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    include: { stations: { select: { status: true } } },
  });
  if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

  const auth = await requireMembership(room.tenantId);
  if (!auth.ok) return auth.response;

  if (room.archivedAt) {
    return NextResponse.json({ ok: true, archived: true });
  }

  if (!canDeleteRoom(room.stations)) {
    return NextResponse.json(
      { error: "room-has-active-session" },
      { status: 409 }
    );
  }

  await prisma.room.update({ where: { id: roomId }, data: { archivedAt: new Date() } });
  return NextResponse.json({ ok: true, archived: true });
}
