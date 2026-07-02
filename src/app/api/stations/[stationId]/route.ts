import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// PATCH /api/stations/[stationId] — rename / change type / status.
export async function PATCH(
  req: NextRequest,
  { params }: { params: { stationId: string } }
) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const data: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
  if (body.type === "PS4" || body.type === "PS5") data.type = body.type;
  if (["FREE", "BUSY", "MAINTENANCE"].includes(String(body.status)))
    data.status = body.status;

  const station = await prisma.station.update({
    where: { id: params.stationId },
    data,
  });
  return NextResponse.json(station);
}

// DELETE /api/stations/[stationId] — remove a console.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { stationId: string } }
) {
  await prisma.station.delete({ where: { id: params.stationId } });
  return NextResponse.json({ ok: true });
}
