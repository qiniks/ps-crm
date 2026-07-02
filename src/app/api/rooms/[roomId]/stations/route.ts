import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST /api/rooms/[roomId]/stations — add a console to the room.
// body: { name, type?, posX?, posY? }
export async function POST(
  req: NextRequest,
  { params }: { params: { roomId: string } }
) {
  const room = await prisma.room.findUnique({ where: { id: params.roomId } });
  if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const name = String(body.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const clamp = (v: unknown, d: number) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : d;
  };

  const station = await prisma.station.create({
    data: {
      roomId: room.id,
      tenantId: room.tenantId,
      name,
      type: body.type === "PS4" ? "PS4" : "PS5",
      posX: clamp(body.posX, 50),
      posY: clamp(body.posY, 50),
    },
  });
  return NextResponse.json(station, { status: 201 });
}
