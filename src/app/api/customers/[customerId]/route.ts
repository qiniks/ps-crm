import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMembership } from "@/lib/auth/requireMembership";

// PATCH /api/customers/[customerId] — update name / phone / balance / bonusPoints.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ customerId: string }> }
) {
  const { customerId } = await params;
  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 });

  const auth = await requireMembership(customer.tenantId);
  if (!auth.ok) return auth.response;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const nonNegativeInt = (v: unknown) => Math.max(0, Math.round(Number(v) || 0));

  const data: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
  if (body.phone !== undefined) data.phone = String(body.phone).trim() || null;
  if (body.balance !== undefined) data.balance = nonNegativeInt(body.balance);
  if (body.bonusPoints !== undefined) data.bonusPoints = nonNegativeInt(body.bonusPoints);

  const updated = await prisma.customer.update({
    where: { id: customerId },
    data,
  });
  return NextResponse.json(updated);
}

// DELETE /api/customers/[customerId] — remove a customer.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ customerId: string }> }
) {
  const { customerId } = await params;
  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 });

  const auth = await requireMembership(customer.tenantId);
  if (!auth.ok) return auth.response;

  await prisma.customer.delete({ where: { id: customerId } });
  return NextResponse.json({ ok: true });
}
