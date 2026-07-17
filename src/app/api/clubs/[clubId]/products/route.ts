import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMembership } from "@/lib/auth/requireMembership";

export const dynamic = "force-dynamic";

// GET /api/clubs/[clubId]/products — active (non-archived) product catalog.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ clubId: string }> }
) {
  const { clubId } = await params;
  const auth = await requireMembership(clubId);
  if (!auth.ok) return auth.response;

  const products = await prisma.product.findMany({
    where: { tenantId: clubId, archivedAt: null },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(
    products.map((p) => ({
      id: p.id,
      name: p.name,
      price: p.price,
      stock: p.stock,
      imageUrl: p.imageUrl,
    }))
  );
}

// POST /api/clubs/[clubId]/products — add a catalog item.
// body: { name, price, stock, imageUrl? }
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
  const imageUrl = typeof body.imageUrl === "string" && body.imageUrl.trim() ? body.imageUrl.trim() : null;

  const product = await prisma.product.create({
    data: {
      tenantId: clubId,
      name,
      price: num(body.price),
      stock: num(body.stock),
      imageUrl,
    },
  });
  return NextResponse.json(product, { status: 201 });
}
