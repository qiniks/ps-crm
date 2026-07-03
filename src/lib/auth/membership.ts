export type MembershipAccess = "unauthenticated" | "forbidden" | "authorized";

// Pure decision: given who's asking (or nobody) and the tenants they belong
// to, can they access `tenantId`? No I/O — callers fetch userId/memberships
// however they like (real session + Prisma in production, literals in tests).
export function resolveMembershipAccess(
  userId: string | null,
  memberships: { tenantId: string }[],
  tenantId: string
): MembershipAccess {
  if (!userId) return "unauthenticated";
  return memberships.some((m) => m.tenantId === tenantId) ? "authorized" : "forbidden";
}
