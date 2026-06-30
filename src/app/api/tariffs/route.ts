import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/tariffs — list price plans.
export async function GET() {
  const tariffs = await prisma.tariff.findMany({
    orderBy: { pricePerHour: "desc" },
  });
  return NextResponse.json(tariffs);
}
