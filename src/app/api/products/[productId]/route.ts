import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMembership } from "@/lib/auth/requireMembership";

export const dynamic = "force-dynamic";

// PATCH /api/products/[productId] — rename / reprice / restock / re-image,
// or restore an archived product via { archived: false }.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ productId: string }> }
) {
  const { productId } = await params;
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

  const auth = await requireMembership(product.tenantId);
  if (!auth.ok) return auth.response;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const num = (v: unknown) => Math.max(0, Math.round(Number(v) || 0));

  const data: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
  if (body.price !== undefined) data.price = num(body.price);
  if (body.stock !== undefined) data.stock = Math.round(Number(body.stock) || 0);
  if (body.imageUrl !== undefined) {
    data.imageUrl = typeof body.imageUrl === "string" && body.imageUrl.trim() ? body.imageUrl.trim() : null;
  }
  // Restore path for an archived product — archiving itself goes through
  // DELETE below, same split as PATCH/DELETE /api/rooms/[roomId].
  if (body.archived === false) data.archivedAt = null;

  const updated = await prisma.product.update({ where: { id: productId }, data });
  return NextResponse.json(updated);
}

// DELETE /api/products/[productId] — archive a product (soft delete).
// Idempotent: archiving an already-archived product just returns it as-is.
// No "in progress" guard is needed (unlike Room, which blocks on a BUSY
// station) — a product has no analogous in-flight state.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ productId: string }> }
) {
  const { productId } = await params;
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

  const auth = await requireMembership(product.tenantId);
  if (!auth.ok) return auth.response;

  if (product.archivedAt) {
    return NextResponse.json({ ok: true, archived: true });
  }

  await prisma.product.update({ where: { id: productId }, data: { archivedAt: new Date() } });
  return NextResponse.json({ ok: true, archived: true });
}
