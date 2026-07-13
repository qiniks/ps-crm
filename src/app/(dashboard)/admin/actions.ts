"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { getImpersonation, IMPERSONATION_COOKIE, isAdminUser } from "@/lib/auth/impersonation";
import { MEMBERSHIP_ROLES, type MembershipRole } from "@/lib/auth/roles";
import { createConfirmedUser } from "@/lib/supabase/createUser";
import { logAudit } from "@/lib/audit";

function isMembershipRole(value: unknown): value is MembershipRole {
  return typeof value === "string" && (MEMBERSHIP_ROLES as string[]).includes(value);
}

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

// Undo an accidental club archive (see DELETE /api/clubs/[clubId]). Only the
// admin can do this — regular members lose sight of the club the moment it's
// archived, since it drops out of GET /api/clubs, so the admin panel (which
// reads Tenant directly, archived or not) is the only place left to reach it.
export async function restoreClub(formData: FormData) {
  await requireAdmin();
  const tenantId = String(formData.get("tenantId") ?? "").trim();
  if (!tenantId) return;

  await prisma.tenant.update({ where: { id: tenantId }, data: { archivedAt: null } });
  revalidatePath("/admin");
}

export type CreateMemberState = { error: string | null };

// The admin can assign either role directly — this is the only place in the
// app a new OWNER can be created; a club's own Members page (see
// POST /api/clubs/[clubId]/members) only ever creates CASHIER accounts.
export async function createMember(
  _prevState: CreateMemberState,
  formData: FormData
): Promise<CreateMemberState> {
  await requireAdmin();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const tenantId = String(formData.get("tenantId") ?? "").trim();
  const roleValue = formData.get("role");
  const role: MembershipRole = isMembershipRole(roleValue) ? roleValue : "CASHIER";

  if (!email) return { error: "Email is required" };
  if (!tenantId) return { error: "Club is required" };
  if (password.length < 8) return { error: "Password must be at least 8 characters" };

  try {
    const user = await createConfirmedUser(email, password);
    await prisma.membership.create({ data: { userId: user.id, tenantId, role } });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to create user" };
  }

  revalidatePath("/admin");
  return { error: null };
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
