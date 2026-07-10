import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getEffectiveUserId } from "@/lib/auth/impersonation";

export const dynamic = "force-dynamic";

// GET /api/clubs — clubs the current (effective) user is a member of, with
// room counts. When the admin impersonates someone, they see that user's clubs.
export async function GET() {
  const userId = await getEffectiveUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const memberships = await prisma.membership.findMany({
    where: { userId },
    select: { tenantId: true },
  });

  // Archived (soft-deleted) clubs are excluded — see DELETE /api/clubs/[clubId].
  const clubs = await prisma.tenant.findMany({
    where: { id: { in: memberships.map((m) => m.tenantId) }, archivedAt: null },
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { rooms: true } } },
  });

  return NextResponse.json(
    clubs.map((c) => ({ id: c.id, name: c.name, roomCount: c._count.rooms }))
  );
}
