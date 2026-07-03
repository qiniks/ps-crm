import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMembership } from "@/lib/auth/requireMembership";

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
              customerName: sess.customer?.name ?? null,
            }
          : null,
      };
    }),
  });
}
