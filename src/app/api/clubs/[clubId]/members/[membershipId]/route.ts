import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMembership } from "@/lib/auth/requireMembership";
import { canManageMembers, MEMBERSHIP_ROLES, type MembershipRole } from "@/lib/auth/roles";

export const dynamic = "force-dynamic";

function isMembershipRole(value: unknown): value is MembershipRole {
  return typeof value === "string" && (MEMBERSHIP_ROLES as string[]).includes(value);
}

async function requireManager(clubId: string, userId: string, isSuperAdmin: boolean): Promise<boolean> {
  const own = await prisma.membership.findUnique({
    where: { userId_tenantId: { userId, tenantId: clubId } },
    select: { role: true },
  });
  return canManageMembers(own?.role ?? null, isSuperAdmin);
}

// PATCH /api/clubs/[clubId]/members/[membershipId] — change a member's role.
// Only an existing manager (OWNER) may change roles, and only down to
// CASHIER: promoting a member to OWNER isn't allowed here, matching the same
// restriction on creation (see POST above) — OWNER is only ever granted via
// the global admin panel.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ clubId: string; membershipId: string }> }
) {
  const { clubId, membershipId } = await params;
  const auth = await requireMembership(clubId);
  if (!auth.ok) return auth.response;
  if (!(await requireManager(clubId, auth.userId, auth.isSuperAdmin))) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const target = await prisma.membership.findUnique({ where: { id: membershipId } });
  if (!target || target.tenantId !== clubId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  if (!isMembershipRole(body.role)) {
    return NextResponse.json({ error: "role must be one of OWNER, CASHIER" }, { status: 400 });
  }
  if (body.role === "OWNER") {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const updated = await prisma.membership.update({
    where: { id: membershipId },
    data: { role: body.role },
  });
  return NextResponse.json(updated);
}

// DELETE /api/clubs/[clubId]/members/[membershipId] — remove a member's
// access to this club, whether or not they've ever signed in — a member who
// never signed in is still just a Membership row, so deleting it here works
// the same way. Only an existing manager (OWNER) may remove members, and a
// manager can't remove themselves (avoids silently locking every manager out
// of a club with one click).
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ clubId: string; membershipId: string }> }
) {
  const { clubId, membershipId } = await params;
  const auth = await requireMembership(clubId);
  if (!auth.ok) return auth.response;
  if (!(await requireManager(clubId, auth.userId, auth.isSuperAdmin))) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const target = await prisma.membership.findUnique({ where: { id: membershipId } });
  if (!target || target.tenantId !== clubId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (target.userId === auth.userId) {
    return NextResponse.json({ error: "Cannot remove your own membership" }, { status: 400 });
  }

  await prisma.membership.delete({ where: { id: membershipId } });
  return NextResponse.json({ ok: true });
}
