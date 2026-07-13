import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMembership } from "@/lib/auth/requireMembership";
import { canManageMembers } from "@/lib/auth/roles";

export const dynamic = "force-dynamic";

async function requireManager(clubId: string, userId: string, isSuperAdmin: boolean): Promise<boolean> {
  const own = await prisma.membership.findUnique({
    where: { userId_tenantId: { userId, tenantId: clubId } },
    select: { role: true },
  });
  return canManageMembers(own?.role ?? null, isSuperAdmin);
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
