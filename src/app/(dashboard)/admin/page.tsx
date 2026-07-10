import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { isAdminUser } from "@/lib/auth/impersonation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createClub, impersonateUser, inviteMember, restoreClub } from "./actions";
import { AdminPageClient, type AdminUserRow } from "./AdminPageClient";

export default async function AdminPage() {
  const user = await getSessionUser();
  if (!isAdminUser(user)) {
    redirect("/clubs");
  }

  const supabaseAdmin = createSupabaseAdminClient();
  const [clubs, memberships, usersResult] = await Promise.all([
    prisma.tenant.findMany({ orderBy: { name: "asc" } }),
    prisma.membership.findMany({ include: { tenant: { select: { name: true } } } }),
    supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 }),
  ]);

  if (usersResult.error) {
    throw new Error(`Failed to list users: ${usersResult.error.message}`);
  }

  const tenantsByUser = new Map<string, string[]>();
  for (const m of memberships) {
    const list = tenantsByUser.get(m.userId) ?? [];
    list.push(m.tenant.name);
    tenantsByUser.set(m.userId, list);
  }

  const users: AdminUserRow[] = usersResult.data.users.map((u) => ({
    id: u.id,
    email: u.email ?? null,
    lastSignInAt: u.last_sign_in_at ?? null,
    tenants: tenantsByUser.get(u.id) ?? [],
    isAdmin: !!u.email && u.email === process.env.ADMIN_EMAIL,
  }));

  return (
    <AdminPageClient
      clubs={clubs}
      users={users}
      createClub={createClub}
      inviteMember={inviteMember}
      impersonateUser={impersonateUser}
      restoreClub={restoreClub}
    />
  );
}
