import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { EffectiveAccess } from "./impersonation";

// The set of tenants `access` may see: every tenant for the super-admin (see
// requireMembership()'s implicit access), otherwise only the ones they hold
// a Membership in. Combine with `archivedAt: null` (and any search filter) at
// the call site — this only resolves the membership half of the scope.
export async function getVisibleTenantScope(access: EffectiveAccess): Promise<Prisma.TenantWhereInput> {
  if (access.isSuperAdmin) return {};

  const memberships = await prisma.membership.findMany({
    where: { userId: access.userId },
    select: { tenantId: true },
  });
  return { id: { in: memberships.map((m) => m.tenantId) } };
}
