import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Always read live from the DB — never serve a build-time snapshot.
export const dynamic = "force-dynamic";

// GET /api/stations — all stations with their active session (if any).
export async function GET() {
  const stations = await prisma.station.findMany({
    orderBy: { name: "asc" },
    include: {
      sessions: {
        where: { status: "ACTIVE" },
        include: { customer: true },
        take: 1,
      },
    },
  });

  const data = stations.map((s) => ({
    id: s.id,
    name: s.name,
    type: s.type,
    status: s.status,
    hourlyRate: s.hourlyRate,
    activeSession: s.sessions[0]
      ? {
          id: s.sessions[0].id,
          startedAt: s.sessions[0].startedAt,
          customerName: s.sessions[0].customer?.name ?? null,
        }
      : null,
  }));

  return NextResponse.json(data);
}
