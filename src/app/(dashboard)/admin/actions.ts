"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { getImpersonation, IMPERSONATION_COOKIE, isAdminUser } from "@/lib/auth/impersonation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";

async function requireAdmin() {
  const user = await getSessionUser();
  if (!isAdminUser(user)) {
    throw new Error("Not authorized");
  }
  return user!;
}

export async function createClub(formData: FormData) {
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  await prisma.tenant.create({ data: { name } });
  revalidatePath("/admin");
}

export async function inviteMember(formData: FormData) {
  await requireAdmin();
  const email = String(formData.get("email") ?? "").trim();
  const tenantId = String(formData.get("tenantId") ?? "").trim();
  if (!email || !tenantId) return;

  const supabaseAdmin = createSupabaseAdminClient();
  const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback?next=/set-password`,
  });

  if (error || !data.user) {
    throw new Error(`Failed to invite ${email}: ${error?.message ?? "unknown error"}`);
  }

  await prisma.membership.create({
    data: { userId: data.user.id, tenantId },
  });

  revalidatePath("/admin");
}

// Start browsing the app as another user. Only the admin can set this, and the
// cookie is only ever honored for an admin session (see lib/auth/impersonation).
export async function impersonateUser(formData: FormData) {
  const admin = await requireAdmin();
  const userId = String(formData.get("userId") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  if (!userId || userId === admin.id) return;

  (await cookies()).set(IMPERSONATION_COOKIE, JSON.stringify({ userId, email: email || null }), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });

  await logAudit({
    actorUserId: admin.id,
    actorEmail: admin.email ?? null,
    action: "impersonation.start",
    targetType: "User",
    targetId: userId,
    metadata: { targetEmail: email || null },
  });

  redirect("/clubs");
}

// No admin guard needed: clearing your own cookie is harmless, and only the
// admin's cookie ever had an effect in the first place.
export async function stopImpersonation() {
  const realUser = await getSessionUser();
  const impersonation = await getImpersonation(realUser);

  (await cookies()).delete(IMPERSONATION_COOKIE);

  if (impersonation) {
    await logAudit({
      actorUserId: realUser?.id ?? null,
      actorEmail: realUser?.email ?? null,
      action: "impersonation.stop",
      targetType: "User",
      targetId: impersonation.userId,
      metadata: { targetEmail: impersonation.email },
    });
  }

  redirect("/admin");
}
