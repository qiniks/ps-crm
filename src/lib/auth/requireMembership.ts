import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getEffectiveAccess } from "./impersonation";
import { resolveMembershipAccess } from "./membership";

type MembershipResult =
  | { ok: true; userId: string; isSuperAdmin: boolean }
  | { ok: false; response: NextResponse };

// Call this at the top of any route that reads or mutates data scoped to a
// specific tenantId. Callers must resolve tenantId themselves first — for
// clubId-prefixed routes it comes straight from the URL; for routes shaped
// around a room/station/session, look up that resource's own tenantId column
// (every one of those models carries it directly, see prisma/schema.prisma).
// Membership is checked against the effective user, so an impersonating
// admin gets exactly the access of the user they're viewing as. The
// super-admin (not impersonating) instead gets implicit access to every
// tenant that exists — no Membership row required — so `isSuperAdmin` is
// returned for callers that gate management actions on the caller's role
// (see canManageMembers()).
export async function requireMembership(tenantId: string): Promise<MembershipResult> {
  const access = await getEffectiveAccess();
  if (!access) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Not authenticated" }, { status: 401 }),
    };
  }

  if (access.isSuperAdmin) {
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true } });
    if (!tenant) {
      return {
        ok: false,
        response: NextResponse.json({ error: "Not found" }, { status: 404 }),
      };
    }
    return { ok: true, userId: access.userId, isSuperAdmin: true };
  }

  const memberships = await prisma.membership.findMany({
    where: { userId: access.userId },
    select: { tenantId: true },
  });

  if (resolveMembershipAccess(access.userId, memberships, tenantId) === "forbidden") {
    // 404, not 403 — deliberately doesn't confirm this tenantId exists to a
    // caller who isn't a member of it.
    return {
      ok: false,
      response: NextResponse.json({ error: "Not found" }, { status: 404 }),
    };
  }
  return { ok: true, userId: access.userId, isSuperAdmin: false };
}
