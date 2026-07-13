import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMembership } from "@/lib/auth/requireMembership";
import { canManageMembers } from "@/lib/auth/roles";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createConfirmedUser } from "@/lib/supabase/createUser";

export const dynamic = "force-dynamic";

// GET /api/clubs/[clubId]/members — this club's memberships, with email and
// sign-in status resolved against Supabase Auth. Any member of the
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
  const canManage = canManageMembers(own?.role ?? null, auth.isSuperAdmin);

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
        // "pending" just means this account has never been used to sign in yet.
        pending: !user?.last_sign_in_at,
        isSelf: m.userId === auth.userId,
      };
    }),
  });
}

// POST /api/clubs/[clubId]/members — create a new user directly into this
// club with a password. Only an existing manager (OWNER) may do this, and
// only as CASHIER — creating (or promoting to) OWNER is only possible via the
// global admin panel (see createMember in admin/actions.ts).
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
  if (!canManageMembers(own?.role ?? null, auth.isSuperAdmin)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const email = String(body.email ?? "").trim();
  const password = String(body.password ?? "");
  if (!email) return NextResponse.json({ error: "email is required" }, { status: 400 });
  if (password.length < 8) {
    return NextResponse.json({ error: "password must be at least 8 characters" }, { status: 400 });
  }

  let user;
  try {
    user = await createConfirmedUser(email, password);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create user" },
      { status: 400 }
    );
  }

  const membership = await prisma.membership.create({
    data: { userId: user.id, tenantId: clubId, role: "CASHIER" },
  });

  return NextResponse.json(membership, { status: 201 });
}
