import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMembership } from "@/lib/auth/requireMembership";
import { parseDateRangeParams } from "@/lib/dateRangeQuery";
import { addDays, localDayKey } from "@/lib/time";

export const dynamic = "force-dynamic";

const TOP_CUSTOMERS = 5;

// GET /api/clubs/[clubId]/analytics?preset=today|week|month|custom&from=&to=
// Aggregates for the analytics page over the selected date range (defaults
// to "month" when no/invalid params are given): totals, peak hours, weekday
// load, tariff/room popularity, a daily revenue trend spanning the whole
// range, and top customers. All grouping uses server-local time — see
// src/lib/time.ts.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ clubId: string }> }
) {
  const { clubId } = await params;
  const auth = await requireMembership(clubId);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(req.url);
  const range = parseDateRangeParams(searchParams, "month");

  const [sessions, activeNow] = await Promise.all([
    prisma.session.findMany({
      where: {
        tenantId: clubId,
        status: "FINISHED",
        endedAt: { gte: range.from, lt: range.to },
      },
      include: {
        station: { select: { room: { select: { id: true, name: true } } } },
        customer: { select: { id: true, name: true } },
      },
    }),
    prisma.session.count({ where: { tenantId: clubId, status: "ACTIVE" } }),
  ]);

  const revenue = sessions.reduce((sum, s) => sum + s.cost, 0);
  const sessionsCount = sessions.length;
  const avgCheck = sessionsCount ? Math.round(revenue / sessionsCount) : 0;
  const totalDurationMs = sessions.reduce(
    (sum, s) => sum + (s.endedAt!.getTime() - s.startedAt.getTime()),
    0
  );
  const avgDurationMin = sessionsCount ? Math.round(totalDurationMs / sessionsCount / 60_000) : 0;

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

  // Daily revenue for the trend chart, spanning the whole selected range,
  // oldest → newest, zero-filled.
  const totalDays = Math.round((range.to.getTime() - range.from.getTime()) / 86_400_000);
  const byDay: { date: string; revenue: number; count: number }[] = [];
  const dayIndex = new Map<string, number>();
  for (let i = 0; i < totalDays; i++) {
    const key = localDayKey(addDays(range.from, i));
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
    totals: { revenue, sessionsCount, avgCheck, avgDurationMin, activeNow },
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
