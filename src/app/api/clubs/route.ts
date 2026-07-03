import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/clubs — all clubs (tenants) with room counts.
export async function GET() {
  try {
    const clubs = await prisma.tenant.findMany({
      orderBy: { createdAt: "asc" },
      include: { _count: { select: { rooms: true } } },
    });
    return NextResponse.json(
      clubs.map((c) => ({ id: c.id, name: c.name, roomCount: c._count.rooms }))
    );
  } catch (err) {
    console.error("GET /api/clubs failed:", err);
    return NextResponse.json({ error: "Failed to load clubs" }, { status: 500 });
  }
}

// POST /api/clubs — create a club. body: { name }
export async function POST(req: NextRequest) {
  const { name } = (await req.json().catch(() => ({}))) as { name?: string };
  if (!name?.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  const club = await prisma.tenant.create({ data: { name: name.trim() } });
  return NextResponse.json(club, { status: 201 });
}
