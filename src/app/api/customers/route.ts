import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/customers — list customers.
export async function GET() {
  const customers = await prisma.customer.findMany({
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(customers);
}

// POST /api/customers — create a customer.
// body: { name: string, phone?: string }
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { name, phone } = body as { name?: string; phone?: string };

  if (!name?.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const customer = await prisma.customer.create({
    data: { name: name.trim(), phone: phone?.trim() || null },
  });
  return NextResponse.json(customer, { status: 201 });
}
