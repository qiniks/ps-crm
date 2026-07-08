import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMembership } from "@/lib/auth/requireMembership";
import { getSessionUser } from "@/lib/auth/session";
import { expectedCash } from "@/lib/shifts";

export const dynamic = "force-dynamic";

const HISTORY_LIMIT = 20;

type ShiftTotals = { cashRevenue: number; cardRevenue: number; sessionsCount: number };

function totalsOf(sessions: { cost: number; paymentMethod: string | null }[]): ShiftTotals {
  let cashRevenue = 0;
  let cardRevenue = 0;
  for (const s of sessions) {
    if (s.paymentMethod === "CASH") cashRevenue += s.cost;
    else if (s.paymentMethod === "CARD") cardRevenue += s.cost;
  }
  return { cashRevenue, cardRevenue, sessionsCount: sessions.length };
}

// GET /api/clubs/[clubId]/shifts — the currently open shift (with live cash
// expectations) plus recent closed shifts.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ clubId: string }> }
) {
  const { clubId } = await params;
  const auth = await requireMembership(clubId);
  if (!auth.ok) return auth.response;

  const shifts = await prisma.shift.findMany({
    where: { tenantId: clubId },
    orderBy: { openedAt: "desc" },
    take: HISTORY_LIMIT + 1, // open shift (if any) rides along with history
    include: { sessions: { select: { cost: true, paymentMethod: true } } },
  });

  const open = shifts.find((s) => s.status === "OPEN");
  const closed = shifts.filter((s) => s.status === "CLOSED").slice(0, HISTORY_LIMIT);

  const serialize = (shift: (typeof shifts)[number]) => {
    const totals = totalsOf(shift.sessions);
    const expected = expectedCash(shift.openingCash, shift.sessions);
    return {
      id: shift.id,
      openedBy: shift.openedBy,
      openedAt: shift.openedAt,
      closedAt: shift.closedAt,
      openingCash: shift.openingCash,
      closingCash: shift.closingCash,
      status: shift.status,
      expectedCash: expected,
      difference: shift.closingCash != null ? shift.closingCash - expected : null,
      ...totals,
    };
  };

  return NextResponse.json({
    current: open ? serialize(open) : null,
    history: closed.map(serialize),
  });
}

// POST /api/clubs/[clubId]/shifts — open a shift. body: { openingCash }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ clubId: string }> }
) {
  const { clubId } = await params;
  const auth = await requireMembership(clubId);
  if (!auth.ok) return auth.response;

  const body = (await req.json().catch(() => ({}))) as { openingCash?: number };
  const openingCash = Math.round(Number(body.openingCash ?? 0));
  if (!Number.isFinite(openingCash) || openingCash < 0) {
    return NextResponse.json({ error: "invalid openingCash" }, { status: 400 });
  }

  const alreadyOpen = await prisma.shift.findFirst({
    where: { tenantId: clubId, status: "OPEN" },
  });
  if (alreadyOpen) {
    return NextResponse.json({ error: "A shift is already open" }, { status: 409 });
  }

  // The real signed-in user, not the impersonated one — the admin browsing as
  // someone must not stamp that user's name on a drawer they opened.
  const user = await getSessionUser();

  const shift = await prisma.shift.create({
    data: {
      tenantId: clubId,
      openedById: user?.id ?? auth.userId,
      openedBy: user?.email ?? "",
      openingCash,
    },
  });

  return NextResponse.json(shift, { status: 201 });
}
