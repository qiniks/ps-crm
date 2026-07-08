"use client";

import { IconSpy } from "@tabler/icons-react";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import { Button } from "@/components/ui/button";

// Shown across the top of the dashboard while the admin is browsing the app
// as another user. `onExit` is the stopImpersonation server action.
export function ImpersonationBanner({
  email,
  onExit,
}: {
  email: string | null;
  onExit: () => Promise<void>;
}) {
  const { t } = useI18n();
  return (
    <div className="flex items-center justify-between gap-3 border-b border-warning/40 bg-warning/15 px-4 py-2 text-sm text-foreground">
      <div className="flex items-center gap-2">
        <IconSpy className="h-4 w-4 shrink-0 text-warning" />
        <span>
          {t("admin.impersonating")}{" "}
          <span className="font-semibold">{email ?? t("admin.unknownUser")}</span>
        </span>
      </div>
      <form action={onExit}>
        <Button size="sm" variant="outline">
          {t("admin.exitImpersonation")}
        </Button>
      </form>
    </div>
  );
}
