import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMembership } from "@/lib/auth/requireMembership";
import { localDayKey, startOfLocalDayDaysAgo } from "@/lib/time";

export const dynamic = "force-dynamic";

const DAYS = 30;
const TREND_DAYS = 14;
const TOP_CUSTOMERS = 5;

// GET /api/clubs/[clubId]/analytics — 30-day aggregates for the analytics page:
// totals, peak hours, weekday load, tariff/room popularity, daily revenue trend,
// top customers. All grouping uses server-local time — see src/lib/time.ts.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ clubId: string }> }
) {
  const { clubId } = await params;
  const auth = await requireMembership(clubId);
  if (!auth.ok) return auth.response;

  const since = startOfLocalDayDaysAgo(DAYS);

  const [sessions, activeNow] = await Promise.all([
    prisma.session.findMany({
      where: { tenantId: clubId, status: "FINISHED", endedAt: { gte: since } },
      include: {
        station: { select: { room: { select: { id: true, name: true } } } },
        customer: { select: { id: true, name: true } },
      },
    }),
    prisma.session.count({ where: { tenantId: clubId, status: "ACTIVE" } }),
  ]);

  const revenue30d = sessions.reduce((sum, s) => sum + s.cost, 0);
  const sessions30d = sessions.length;
  const avgCheck = sessions30d ? Math.round(revenue30d / sessions30d) : 0;
  const totalDurationMs = sessions.reduce(
    (sum, s) => sum + (s.endedAt!.getTime() - s.startedAt.getTime()),
    0
  );
  const avgDurationMin = sessions30d ? Math.round(totalDurationMs / sessions30d / 60_000) : 0;

  // Sessions by starting hour (0..23) and by weekday (Monday-first).
  const byHour = Array.from({ length: 24 }, () => 0);
  const byWeekday = Array.from({ length: 7 }, () => 0);
  for (const s of sessions) {
    byHour[s.startedAt.getHours()]++;
    byWeekday[(s.startedAt.getDay() + 6) % 7]++; // JS Sunday=0 → Monday-first index
  }

  const byTariff = new Map<string, { count: number; revenue: number }>();
  const byRoom = new Map<string, { name: string; count: number; revenue: number }>();
  const byCustomer = new Map<string, { name: string; count: number; revenue: number }>();
  for (const s of sessions) {
    const tariff = byTariff.get(s.tariffKind) ?? { count: 0, revenue: 0 };
    tariff.count++;
    tariff.revenue += s.cost;
    byTariff.set(s.tariffKind, tariff);

    const room = s.station.room;
    const roomAgg = byRoom.get(room.id) ?? { name: room.name, count: 0, revenue: 0 };
    roomAgg.count++;
    roomAgg.revenue += s.cost;
    byRoom.set(room.id, roomAgg);

    if (s.customer) {
      const cust = byCustomer.get(s.customer.id) ?? { name: s.customer.name, count: 0, revenue: 0 };
      cust.count++;
      cust.revenue += s.cost;
      byCustomer.set(s.customer.id, cust);
    }
  }

  // Daily revenue for the trend chart, oldest → today, zero-filled.
  const byDay: { date: string; revenue: number; count: number }[] = [];
  const dayIndex = new Map<string, number>();
  for (let i = TREND_DAYS - 1; i >= 0; i--) {
    const key = localDayKey(startOfLocalDayDaysAgo(i));
    dayIndex.set(key, byDay.length);
    byDay.push({ date: key, revenue: 0, count: 0 });
  }
  for (const s of sessions) {
    const key = localDayKey(s.endedAt!);
    const idx = dayIndex.get(key);
    if (idx !== undefined) {
      byDay[idx].revenue += s.cost;
      byDay[idx].count++;
    }
  }

  return NextResponse.json({
    totals: { revenue30d, sessions30d, avgCheck, avgDurationMin, activeNow },
    byHour,
    byWeekday,
    byTariff: [...byTariff.entries()]
      .map(([kind, v]) => ({ kind, ...v }))
      .sort((a, b) => b.count - a.count),
    byRoom: [...byRoom.values()].sort((a, b) => b.revenue - a.revenue),
    byDay,
    topCustomers: [...byCustomer.values()]
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, TOP_CUSTOMERS),
  });
}
