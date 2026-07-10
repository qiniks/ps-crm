import { Sidebar } from "@/components/Sidebar";
import { ImpersonationBanner } from "@/components/ImpersonationBanner";
import { getImpersonation, isAdminUser } from "@/lib/auth/impersonation";
import { getSessionUser } from "@/lib/auth/session";
import { stopImpersonation } from "./admin/actions";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // isAdmin is checked against the real session user, not the effective
  // (possibly impersonated) one — the admin panel link should stay visible
  // even while impersonating, so the admin can get back to it. Fetch the
  // user once and pass it into getImpersonation to avoid a second
  // supabase.auth.getUser() round trip.
  const realUser = await getSessionUser();
  const impersonation = await getImpersonation(realUser);

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {impersonation && (
        <ImpersonationBanner email={impersonation.email} onExit={stopImpersonation} />
      )}
      <div className="flex min-h-0 flex-1">
        <Sidebar isAdmin={isAdminUser(realUser)} />
        <main className="flex-1 overflow-y-auto p-8">{children}</main>
      </div>
    </div>
  );
}
