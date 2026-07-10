import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMembership } from "@/lib/auth/requireMembership";
import { startOfLocalDay } from "@/lib/time";

export const dynamic = "force-dynamic";

// GET /api/clubs/[clubId]/reports — today's revenue summary + recent sessions.
// "Today" uses server-local time — see src/lib/time.ts for the assumption.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ clubId: string }> }
) {
  const { clubId } = await params;
  const auth = await requireMembership(clubId);
  if (!auth.ok) return auth.response;

  const startOfDay = startOfLocalDay();

  const todays = await prisma.session.findMany({
    where: {
      tenantId: clubId,
      status: "FINISHED",
      endedAt: { gte: startOfDay },
    },
  });

  const revenueToday = todays.reduce((sum, s) => sum + s.cost, 0);
  const sessionsToday = todays.length;
  const avgCheck = sessionsToday ? Math.round(revenueToday / sessionsToday) : 0;

  const recent = await prisma.session.findMany({
    where: { tenantId: clubId, status: "FINISHED" },
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
      tariffKind: s.tariffKind,
      customerName: s.customer?.name ?? null,
      endedAt: s.endedAt,
      cost: s.cost,
    })),
  });
}
