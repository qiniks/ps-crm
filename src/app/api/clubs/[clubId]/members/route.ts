import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMembership } from "@/lib/auth/requireMembership";
import { canManageMembers, MEMBERSHIP_ROLES, type MembershipRole } from "@/lib/auth/roles";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function isMembershipRole(value: unknown): value is MembershipRole {
  return typeof value === "string" && (MEMBERSHIP_ROLES as string[]).includes(value);
}

// GET /api/clubs/[clubId]/members — this club's memberships, with email and
// pending-invite status resolved against Supabase Auth. Any member of the
// club can view the list; `canManage` tells the client whether to render
// mutation controls (only an OWNER, see canManageMembers(), gets `true`).
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ clubId: string }> }
) {
  const { clubId } = await params;
  const auth = await requireMembership(clubId);
  if (!auth.ok) return auth.response;

  const memberships = await prisma.membership.findMany({
    where: { tenantId: clubId },
    orderBy: { createdAt: "asc" },
  });

  const own = memberships.find((m) => m.userId === auth.userId);
  const canManage = canManageMembers(own?.role ?? null, false);

  const supabaseAdmin = createSupabaseAdminClient();
  const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error) {
    return NextResponse.json({ error: "Failed to resolve users" }, { status: 500 });
  }
  const usersById = new Map(data.users.map((u) => [u.id, u]));

  return NextResponse.json({
    canManage,
    members: memberships.map((m) => {
      const user = usersById.get(m.userId);
      return {
        id: m.id,
        userId: m.userId,
        email: user?.email ?? null,
        role: m.role,
        // A user Supabase created via inviteUserByEmail exists but has never
        // signed in until they set a password — that's what "pending" means.
        pending: !user?.last_sign_in_at,
        isSelf: m.userId === auth.userId,
      };
    }),
  });
}

// POST /api/clubs/[clubId]/members — invite a new member directly into this
// club with a chosen role. Only an existing manager (OWNER) may invite.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ clubId: string }> }
) {
  const { clubId } = await params;
  const auth = await requireMembership(clubId);
  if (!auth.ok) return auth.response;

  const own = await prisma.membership.findUnique({
    where: { userId_tenantId: { userId: auth.userId, tenantId: clubId } },
    select: { role: true },
  });
  if (!canManageMembers(own?.role ?? null, false)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const email = String(body.email ?? "").trim();
  const role: MembershipRole = isMembershipRole(body.role) ? body.role : "CASHIER";
  if (!email) return NextResponse.json({ error: "email is required" }, { status: 400 });

  const supabaseAdmin = createSupabaseAdminClient();
  const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback?next=/set-password`,
  });

  if (error || !data.user) {
    return NextResponse.json(
      { error: `Failed to invite ${email}: ${error?.message ?? "unknown error"}` },
      { status: 400 }
    );
  }

  const membership = await prisma.membership.create({
    data: { userId: data.user.id, tenantId: clubId, role },
  });

  return NextResponse.json(membership, { status: 201 });
}
