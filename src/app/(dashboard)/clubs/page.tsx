import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getEffectiveAccess } from "@/lib/auth/impersonation";
import { getVisibleTenantScope } from "@/lib/auth/tenantScope";
import { ClubsPageClient } from "./ClubsPageClient";

// A user who belongs to exactly one (active) club has no real use for the
// club picker — sending them there first, only to have the client fetch
// /api/clubs and immediately redirect once it resolves, is a visible flash
// and a wasted round trip right after login. Resolving that here instead,
// before any HTML for the picker is ever sent, means the browser only ever
// navigates straight to that club.
export default async function ClubsPage() {
  const access = await getEffectiveAccess();
  if (!access) {
    redirect("/login");
  }

  const scope = await getVisibleTenantScope(access);
  const visibleClubs = await prisma.tenant.findMany({
    where: { ...scope, archivedAt: null },
    select: { id: true },
    take: 2,
  });

  if (visibleClubs.length === 1) {
    redirect(`/clubs/${visibleClubs[0].id}`);
  }

  return <ClubsPageClient />;
}
