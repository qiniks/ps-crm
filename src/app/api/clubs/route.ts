import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

// GET /api/clubs — clubs the current user is a member of, with room counts.
export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const memberships = await prisma.membership.findMany({
    where: { userId: user.id },
    select: { tenantId: true },
  });

  const clubs = await prisma.tenant.findMany({
    where: { id: { in: memberships.map((m) => m.tenantId) } },
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { rooms: true } } },
  });

  return NextResponse.json(
    clubs.map((c) => ({ id: c.id, name: c.name, roomCount: c._count.rooms }))
  );
}
