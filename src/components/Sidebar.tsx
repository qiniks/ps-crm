"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  IconArrowLeft,
  IconChartBar,
  IconDeviceGamepad2,
  IconLogout,
  IconUsers,
  type Icon,
} from "@tabler/icons-react";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { ThemeToggle } from "./theme-toggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { TranslationKey } from "@/lib/i18n/dictionaries";

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useI18n();

  // Detect the current club from the URL: /clubs/[clubId]/...
  const clubMatch = pathname.match(/^\/clubs\/([^/]+)/);
  const clubId = clubMatch?.[1];

  const items: { href: string; key: TranslationKey; icon: Icon }[] = clubId
    ? [
        { href: `/clubs/${clubId}`, key: "nav.rooms", icon: IconDeviceGamepad2 },
        { href: `/clubs/${clubId}/customers`, key: "nav.customers", icon: IconUsers },
        { href: `/clubs/${clubId}/reports`, key: "nav.reports", icon: IconChartBar },
      ]
    : [{ href: "/clubs", key: "nav.clubs", icon: IconDeviceGamepad2 }];

  async function signOut() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-card p-4">
      <Link href="/clubs" className="mb-6 block px-2">
        <div className="text-lg font-bold text-foreground">{t("app.name")}</div>
        <div className="text-xs text-muted-foreground">{t("app.tagline")}</div>
      </Link>

      {clubId && (
        <Link
          href="/clubs"
          className="mb-2 flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <IconArrowLeft className="h-3.5 w-3.5" />
          {t("nav.clubs")}
        </Link>
      )}

      <nav className="flex flex-1 flex-col gap-1">
        {items.map((item) => {
          const active =
            pathname === item.href ||
            (item.href.endsWith(clubId ?? "___") && pathname.startsWith(item.href + "/rooms"));
          const ItemIcon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <ItemIcon className="h-4 w-4" />
              {t(item.key)}
            </Link>
          );
        })}
      </nav>

      <div className="mt-4 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <LanguageSwitcher />
          <ThemeToggle label={t("theme.toggle")} />
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={signOut}
          className="justify-start gap-2 px-3 text-muted-foreground hover:text-foreground"
        >
          <IconLogout className="h-4 w-4" />
          {t("nav.signOut")}
        </Button>
      </div>
    </aside>
  );
}
