export type MembershipRole = "OWNER" | "CASHIER";

export const MEMBERSHIP_ROLES: MembershipRole[] = ["OWNER", "CASHIER"];

// Pure decision: can this actor manage membership (invite, remove, or change
// another member's role) for a tenant? No I/O — callers resolve the actor's
// own membership role and super-admin status however they like.
//
// Only an explicit "CASHIER" role is restricted. Everything else — "OWNER",
// an unset/null role, or a legacy pre-role value (the schema's old "member"
// default) — is treated as manage-capable. This is deliberate: flipping the
// schema default to "OWNER" only affects *new* memberships; rows already in
// the database keep whatever role they were created with, so treating
// "anything but CASHIER" as owner-equivalent avoids silently locking out
// every member who existed before role tiers shipped.
export function canManageMembers(role: string | null | undefined, isSuperAdmin: boolean): boolean {
  if (isSuperAdmin) return true;
  return role !== "CASHIER";
}
