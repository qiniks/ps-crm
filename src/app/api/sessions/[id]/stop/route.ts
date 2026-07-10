import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { openCost } from "@/lib/tariffs";
import { requireMembership } from "@/lib/auth/requireMembership";
import { canPayFromBalance, isPaymentMethod } from "@/lib/shifts";

// Thrown inside the stop transaction to short-circuit with a specific HTTP
// response — keeps the balance check + decrement + session update atomic
// while still letting the route return a meaningful error.
class StopError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// POST /api/sessions/[id]/stop — finish a session and finalize the bill.
// body: { paymentMethod?: "CASH" | "CARD" | "BALANCE" } — defaults to CASH.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await prisma.session.findUnique({
    where: { id },
    include: { station: { include: { room: true } } },
  });

  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  const auth = await requireMembership(session.tenantId);
  if (!auth.ok) return auth.response;

  if (session.status === "FINISHED") {
    return NextResponse.json({ error: "Session already finished" }, { status: 409 });
  }

  const body = (await req.json().catch(() => ({}))) as { paymentMethod?: string };
  const paymentMethod = body.paymentMethod ?? "CASH";
  if (!isPaymentMethod(paymentMethod)) {
    return NextResponse.json({ error: "invalid paymentMethod" }, { status: 400 });
  }

  const endedAt = new Date();
  const cost =
    session.tariffKind === "OPEN"
      ? openCost(session.startedAt, endedAt, session.station.room.openHourlyRate)
      : session.cost;

  // The payment lands in the club's open shift, if one exists right now.
  const openShift = await prisma.shift.findFirst({
    where: { tenantId: session.tenantId, status: "OPEN" },
    select: { id: true },
  });

  try {
    // Balance check-and-decrement runs in the same transaction as the session
    // finalization: a crash (or a concurrent stop) between them can't leave
    // the customer debited without the session actually being closed, or
    // vice versa.
    const updated = await prisma.$transaction(async (tx) => {
      if (paymentMethod === "BALANCE") {
        if (!session.customerId) {
          throw new StopError(400, "Session has no customer; cannot pay from balance");
        }
        const customer = await tx.customer.findUnique({
          where: { id: session.customerId },
          select: { balance: true },
        });
        if (!canPayFromBalance(customer, cost)) {
          throw new StopError(400, "Insufficient balance");
        }
        await tx.customer.update({
          where: { id: session.customerId },
          data: { balance: { decrement: cost } },
        });
      }

      const updatedSession = await tx.session.update({
        where: { id: session.id },
        data: { endedAt, cost, status: "FINISHED", paymentMethod, shiftId: openShift?.id ?? null },
      });

      await tx.station.update({
        where: { id: session.stationId },
        data: { status: "FREE" },
      });

      return updatedSession;
    });

    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof StopError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
