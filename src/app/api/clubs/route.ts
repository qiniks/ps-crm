import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getEffectiveAccess } from "@/lib/auth/impersonation";
import { getVisibleTenantScope } from "@/lib/auth/tenantScope";
import { parseListParams } from "@/lib/listParams";

export const dynamic = "force-dynamic";

// GET /api/clubs — paginated, optionally-searched (by name) clubs the
// current (effective) user is a member of, with room counts. When the admin
// impersonates someone, they see that user's clubs. The super-admin, when NOT
// impersonating, instead sees every club in the system — they have implicit
// access to all of them (see requireMembership()), so the membership-scoped
// list would otherwise just be empty/misleading for them. Query params:
// page, pageSize, q. Returns { items, total, page, pageSize }.
export async function GET(req: NextRequest) {
  const access = await getEffectiveAccess();
  if (!access) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const tenantScope = await getVisibleTenantScope(access);

  const { skip, take, search, page, pageSize } = parseListParams(req.nextUrl.searchParams);

  // Archived (soft-deleted) clubs are excluded — see DELETE /api/clubs/[clubId].
  // See the customers route for the `mode: "insensitive"` Postgres caveat.
  const where: Prisma.TenantWhereInput = {
    ...tenantScope,
    archivedAt: null,
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
