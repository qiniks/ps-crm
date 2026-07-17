import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMembership } from "@/lib/auth/requireMembership";
import { getSessionUser } from "@/lib/auth/session";
import { canPayFromBalance, isPaymentMethod } from "@/lib/shifts";
import { buildSaleLines, saleTotal, type CartItem } from "@/lib/sales";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

// Thrown inside the checkout transaction to short-circuit with a specific
// HTTP response — same pattern as StopError in the session-stop route.
class SaleError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// POST /api/clubs/[clubId]/sales — check out a product cart.
// body: { items: {productId, quantity}[], paymentMethod, customerId? }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ clubId: string }> }
) {
  const { clubId } = await params;
  const auth = await requireMembership(clubId);
  if (!auth.ok) return auth.response;

  const body = (await req.json().catch(() => ({}))) as {
    items?: CartItem[];
    paymentMethod?: string;
    customerId?: string;
  };

  const items = Array.isArray(body.items) ? body.items : [];
  if (items.length === 0) {
    return NextResponse.json({ error: "cart is empty" }, { status: 400 });
  }

  const paymentMethod = body.paymentMethod ?? "CASH";
  if (!isPaymentMethod(paymentMethod)) {
    return NextResponse.json({ error: "invalid paymentMethod" }, { status: 400 });
  }

  const products = await prisma.product.findMany({
    where: { tenantId: clubId, id: { in: items.map((i) => i.productId) } },
    select: { id: true, price: true, stock: true },
  });

  let lines;
  try {
    lines = buildSaleLines(items, products);
  } catch (err) {
    const message = err instanceof Error ? err.message : "invalid cart";
    return NextResponse.json({ error: message }, { status: 400 });
  }
  const cost = saleTotal(lines);

  const openShift = await prisma.shift.findFirst({
    where: { tenantId: clubId, status: "OPEN" },
    select: { id: true },
  });

  const user = await getSessionUser();

  try {
    const sale = await prisma.$transaction(async (tx) => {
      if (paymentMethod === "BALANCE") {
        if (!body.customerId) {
          throw new SaleError(400, "customerId is required to pay from balance");
        }
        const customer = await tx.customer.findUnique({
          where: { id: body.customerId },
          select: { balance: true },
        });
        if (!canPayFromBalance(customer, cost)) {
          throw new SaleError(400, "Insufficient balance");
        }
        await tx.customer.update({
          where: { id: body.customerId },
          data: { balance: { decrement: cost } },
        });
      }

      for (const line of lines) {
        await tx.product.update({
          where: { id: line.productId },
          data: { stock: { decrement: line.quantity } },
        });
      }

      return tx.sale.create({
        data: {
          tenantId: clubId,
          customerId: paymentMethod === "BALANCE" ? body.customerId : (body.customerId ?? null),
          cost,
          paymentMethod,
          shiftId: openShift?.id ?? null,
          createdBy: user?.email ?? "",
          lines: { create: lines },
        },
        include: { lines: true },
      });
    });

    await logAudit({
      tenantId: clubId,
      actorUserId: user?.id ?? auth.userId,
      actorEmail: user?.email ?? null,
      action: "sale.create",
      targetType: "Sale",
      targetId: sale.id,
      metadata: { cost, paymentMethod, lineCount: lines.length },
    });

    return NextResponse.json(sale, { status: 201 });
  } catch (err) {
    if (err instanceof SaleError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
