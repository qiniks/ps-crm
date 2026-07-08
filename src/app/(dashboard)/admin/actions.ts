"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

async function requireAdmin() {
  const user = await getSessionUser();
  if (!user || user.email !== process.env.ADMIN_EMAIL) {
    throw new Error("Not authorized");
  }
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
