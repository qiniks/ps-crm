import { Sidebar } from "@/components/Sidebar";
import { ImpersonationBanner } from "@/components/ImpersonationBanner";
import { getImpersonation } from "@/lib/auth/impersonation";
import { stopImpersonation } from "./admin/actions";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const impersonation = await getImpersonation();

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {impersonation && (
        <ImpersonationBanner email={impersonation.email} onExit={stopImpersonation} />
      )}
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-8">{children}</main>
      </div>
    </div>
  );
}
