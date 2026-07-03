import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "./session";
import { resolveMembershipAccess } from "./membership";

type MembershipResult = { ok: true; userId: string } | { ok: false; response: NextResponse };

// Call this at the top of any route that reads or mutates data scoped to a
// specific tenantId. Callers must resolve tenantId themselves first — for
// clubId-prefixed routes it comes straight from the URL; for routes shaped
// around a room/station/session, look up that resource's own tenantId column
// (every one of those models carries it directly, see prisma/schema.prisma).
export async function requireMembership(tenantId: string): Promise<MembershipResult> {
  const user = await getSessionUser();

  const memberships = user
    ? await prisma.membership.findMany({
        where: { userId: user.id },
        select: { tenantId: true },
      })
    : [];

  const access = resolveMembershipAccess(user?.id ?? null, memberships, tenantId);

  if (access === "unauthenticated") {
    return {
      ok: false,
      response: NextResponse.json({ error: "Not authenticated" }, { status: 401 }),
    };
  }
  if (access === "forbidden") {
    // 404, not 403 — deliberately doesn't confirm this tenantId exists to a
    // caller who isn't a member of it.
    return {
      ok: false,
      response: NextResponse.json({ error: "Not found" }, { status: 404 }),
    };
  }
  return { ok: true, userId: user!.id };
}
