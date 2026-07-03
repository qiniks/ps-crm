import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMembership } from "@/lib/auth/requireMembership";

export const dynamic = "force-dynamic";

// GET /api/clubs/[clubId]/customers — customers of a club.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ clubId: string }> }
) {
  const { clubId } = await params;
  const auth = await requireMembership(clubId);
  if (!auth.ok) return auth.response;

  const customers = await prisma.customer.findMany({
    where: { tenantId: clubId },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(customers);
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
