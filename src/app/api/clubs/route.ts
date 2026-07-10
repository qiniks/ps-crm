import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getEffectiveUserId } from "@/lib/auth/impersonation";
import { parseListParams } from "@/lib/listParams";

export const dynamic = "force-dynamic";

// GET /api/clubs — paginated, optionally-searched (by name) clubs the
// current (effective) user is a member of, with room counts. When the admin
// impersonates someone, they see that user's clubs. Query params: page,
// pageSize, q. Returns { items, total, page, pageSize }.
export async function GET(req: NextRequest) {
  const userId = await getEffectiveUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // A user's own membership list isn't a user-facing paginated view — it's
  // just used to scope the tenant search below, so it's left unbounded here.
  const memberships = await prisma.membership.findMany({
    where: { userId },
    select: { tenantId: true },
  });

  const { skip, take, search, page, pageSize } = parseListParams(req.nextUrl.searchParams);

  // See the customers route for the `mode: "insensitive"` Postgres caveat.
  const where: Prisma.TenantWhereInput = {
    id: { in: memberships.map((m) => m.tenantId) },
    ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
  };

  const [clubs, total] = await Promise.all([
    prisma.tenant.findMany({
      where,
      orderBy: { createdAt: "asc" },
      include: { _count: { select: { rooms: true } } },
      skip,
      take,
    }),
    prisma.tenant.count({ where }),
  ]);

  return NextResponse.json({
    items: clubs.map((c) => ({ id: c.id, name: c.name, roomCount: c._count.rooms })),
    total,
    page,
    pageSize,
  });
}
