import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMembership } from "@/lib/auth/requireMembership";
import { parseDateRangeParams } from "@/lib/dateRangeQuery";

export const dynamic = "force-dynamic";

// GET /api/clubs/[clubId]/reports?preset=today|week|month|custom&from=&to=
// Revenue summary + recent sessions for the selected date range (defaults to
// "today" when no/invalid params are given). Range boundaries use
// server-local time — see src/lib/time.ts for the assumption.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ clubId: string }> }
) {
  const { clubId } = await params;
  const auth = await requireMembership(clubId);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(req.url);
  const range = parseDateRangeParams(searchParams, "today");

  const inRange = await prisma.session.findMany({
    where: {
      tenantId: clubId,
      status: "FINISHED",
      endedAt: { gte: range.from, lt: range.to },
    },
  });

  const revenue = inRange.reduce((sum, s) => sum + s.cost, 0);
  const sessionsCount = inRange.length;
  const avgCheck = sessionsCount ? Math.round(revenue / sessionsCount) : 0;

  const recent = await prisma.session.findMany({
    where: {
      tenantId: clubId,
      status: "FINISHED",
      endedAt: { gte: range.from, lt: range.to },
    },
    include: { station: true, customer: true },
    orderBy: { endedAt: "desc" },
    take: 20,
  });

  return NextResponse.json({
    revenue,
    sessionsCount,
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
