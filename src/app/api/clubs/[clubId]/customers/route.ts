import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireMembership } from "@/lib/auth/requireMembership";
import { parseListParams } from "@/lib/listParams";

export const dynamic = "force-dynamic";

// GET /api/clubs/[clubId]/customers — paginated, optionally-searched
// customers of a club. Query params: page, pageSize, q (matches name/phone).
// Returns { items, total, page, pageSize } so the UI can render page controls.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ clubId: string }> }
) {
  const { clubId } = await params;
  const auth = await requireMembership(clubId);
  if (!auth.ok) return auth.response;

  const { skip, take, search, page, pageSize } = parseListParams(req.nextUrl.searchParams);

  // `mode: "insensitive"` is a Postgres/MongoDB-only Prisma feature — fine
  // here since the datasource is postgresql, but if this app is ever run
  // against the SQLite dev provider (see CLAUDE.md), this filter would need
  // to drop `mode` (SQLite's default text comparison is already
  // case-insensitive for ASCII via `contains`, just not accent-insensitive).
  const where: Prisma.CustomerWhereInput = {
    tenantId: clubId,
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { phone: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.customer.findMany({ where, orderBy: { createdAt: "desc" }, skip, take }),
    prisma.customer.count({ where }),
  ]);

  return NextResponse.json({ items, total, page, pageSize });
}

// POST /api/clubs/[clubId]/customers — add a customer. body: { name, phone? }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ clubId: string }> }
) {
  const { clubId } = await params;
  const auth = await requireMembership(clubId);
  if (!auth.ok) return auth.response;

  const body = (await req.json().catch(() => ({}))) as { name?: string; phone?: string };
  if (!body.name?.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  const customer = await prisma.customer.create({
    data: {
      tenantId: clubId,
      name: body.name.trim(),
      phone: body.phone?.trim() || null,
    },
  });
  return NextResponse.json(customer, { status: 201 });
}
