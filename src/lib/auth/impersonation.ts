import { cookies } from "next/headers";
import type { User } from "@supabase/supabase-js";
import { getSessionUser } from "./session";

// The admin can browse the app as any tenant user. The choice is kept in an
// httpOnly cookie, but the cookie alone grants nothing: it is honored only
// when the REAL Supabase session belongs to ADMIN_EMAIL, so a forged cookie
// on a non-admin session is ignored.
export const IMPERSONATION_COOKIE = "ps-crm.impersonate";

export type Impersonation = { userId: string; email: string | null };

export function isAdminUser(user: User | null): boolean {
  return !!user?.email && user.email === process.env.ADMIN_EMAIL;
}

function parseImpersonationCookie(raw: string | undefined): Impersonation | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed.userId !== "string" || !parsed.userId) return null;
    return { userId: parsed.userId, email: typeof parsed.email === "string" ? parsed.email : null };
  } catch {
    return null;
  }
}

// The active impersonation for this request, or null when the admin isn't
// impersonating anyone (or the requester isn't the admin at all).
export async function getImpersonation(realUser?: User | null): Promise<Impersonation | null> {
  const user = realUser === undefined ? await getSessionUser() : realUser;
  if (!isAdminUser(user)) return null;
  const store = await cookies();
  return parseImpersonationCookie(store.get(IMPERSONATION_COOKIE)?.value);
}

// Who the request should be treated as: the impersonated user when the admin
// is impersonating, otherwise the real session user.
export async function getEffectiveUserId(): Promise<string | null> {
  const user = await getSessionUser();
  if (!user) return null;
  const impersonation = await getImpersonation(user);
  return impersonation?.userId ?? user.id;
}
