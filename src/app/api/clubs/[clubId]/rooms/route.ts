import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMembership } from "@/lib/auth/requireMembership";

export const dynamic = "force-dynamic";

// GET /api/clubs/[clubId]/rooms — rooms of a club with station counts.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ clubId: string }> }
) {
  const { clubId } = await params;
  const auth = await requireMembership(clubId);
  if (!auth.ok) return auth.response;

  const club = await prisma.tenant.findUniqueOrThrow({ where: { id: clubId } });
  const rooms = await prisma.room.findMany({
    where: { tenantId: clubId },
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { stations: true } } },
  });

  return NextResponse.json({
    club: { id: club.id, name: club.name },
    rooms: rooms.map((r) => ({
      id: r.id,
      name: r.name,
      price1h: r.price1h,
      price3h: r.price3h,
      price5h: r.price5h,
      openHourlyRate: r.openHourlyRate,
      stationCount: r._count.stations,
    })),
  });
}

// POST /api/clubs/[clubId]/rooms — create a room with per-room pricing.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ clubId: string }> }
) {
  const { clubId } = await params;
  const auth = await requireMembership(clubId);
  if (!auth.ok) return auth.response;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const name = String(body.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const num = (v: unknown) => Math.max(0, Math.round(Number(v) || 0));

  const room = await prisma.room.create({
    data: {
      tenantId: clubId,
      name,
      price1h: num(body.price1h),
      price3h: num(body.price3h),
      price5h: num(body.price5h),
      openHourlyRate: num(body.openHourlyRate),
    },
  });
  return NextResponse.json(room, { status: 201 });
}
