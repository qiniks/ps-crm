import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMembership } from "@/lib/auth/requireMembership";

// PUT /api/rooms/[roomId]/layout — persist station positions after editing.
// body: { positions: { id: string, posX: number, posY: number }[] }
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  const room = await prisma.room.findUnique({ where: { id: roomId } });
  if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

  const auth = await requireMembership(room.tenantId);
  if (!auth.ok) return auth.response;

  const body = (await req.json().catch(() => ({}))) as {
    positions?: { id: string; posX: number; posY: number }[];
  };
  const positions = body.positions ?? [];

  const clamp = (n: number) => Math.min(100, Math.max(0, Number(n) || 0));

  // Only touch stations that actually belong to this room.
  await prisma.$transaction(
    positions.map((p) =>
      prisma.station.updateMany({
        where: { id: p.id, roomId },
        data: { posX: clamp(p.posX), posY: clamp(p.posY) },
      })
    )
  );

  return NextResponse.json({ ok: true, saved: positions.length });
}
