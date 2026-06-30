import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/reports — today's revenue summary + recent finished sessions.
export async function GET() {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const todays = await prisma.session.findMany({
    where: { status: "FINISHED", endedAt: { gte: startOfDay } },
    include: { station: true },
  });

  const revenueToday = todays.reduce((sum, s) => sum + s.cost, 0);
  const sessionsToday = todays.length;
  const avgCheck = sessionsToday ? Math.round(revenueToday / sessionsToday) : 0;

  const recent = await prisma.session.findMany({
    where: { status: "FINISHED" },
    include: { station: true, customer: true },
    orderBy: { endedAt: "desc" },
    take: 20,
  });

  return NextResponse.json({
    revenueToday,
    sessionsToday,
    avgCheck,
    recent: recent.map((s) => ({
      id: s.id,
      station: s.station.name,
      customerName: s.customer?.name ?? null,
      startedAt: s.startedAt,
      endedAt: s.endedAt,
      cost: s.cost,
    })),
  });
}
