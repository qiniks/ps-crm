import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMembership } from "@/lib/auth/requireMembership";
import { getSessionUser } from "@/lib/auth/session";
import { logAudit } from "@/lib/audit";

// PATCH /api/stations/[stationId] — rename / change type / status.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ stationId: string }> }
) {
  const { stationId } = await params;
  const station = await prisma.station.findUnique({ where: { id: stationId } });
  if (!station) return NextResponse.json({ error: "Station not found" }, { status: 404 });

  const auth = await requireMembership(station.tenantId);
  if (!auth.ok) return auth.response;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const data: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
  if (body.type === "PS4" || body.type === "PS5") data.type = body.type;
  if (["FREE", "BUSY", "MAINTENANCE"].includes(String(body.status)))
    data.status = body.status;

  const updated = await prisma.station.update({
    where: { id: stationId },
    data,
  });
  return NextResponse.json(updated);
}

// DELETE /api/stations/[stationId] — remove a console.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ stationId: string }> }
) {
  const { stationId } = await params;
  const station = await prisma.station.findUnique({ where: { id: stationId } });
  if (!station) return NextResponse.json({ error: "Station not found" }, { status: 404 });

  const auth = await requireMembership(station.tenantId);
  if (!auth.ok) return auth.response;

  await prisma.station.delete({ where: { id: stationId } });

  const user = await getSessionUser();
  await logAudit({
    tenantId: station.tenantId,
    actorUserId: user?.id ?? auth.userId,
    actorEmail: user?.email ?? null,
    action: "station.delete",
    targetType: "Station",
    targetId: station.id,
    metadata: { name: station.name, roomId: station.roomId },
  });

  return NextResponse.json({ ok: true });
}
