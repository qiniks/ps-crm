"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import { LanguageSwitcher } from "./LanguageSwitcher";
import type { TranslationKey } from "@/lib/i18n/dictionaries";

export function Sidebar() {
  const pathname = usePathname();
  const { t } = useI18n();

  // Detect the current club from the URL: /clubs/[clubId]/...
  const clubMatch = pathname.match(/^\/clubs\/([^/]+)/);
  const clubId = clubMatch?.[1];

  const items: { href: string; key: TranslationKey; icon: string }[] = clubId
    ? [
        { href: `/clubs/${clubId}`, key: "nav.rooms", icon: "🏠" },
        { href: `/clubs/${clubId}/customers`, key: "nav.customers", icon: "👥" },
        { href: `/clubs/${clubId}/reports`, key: "nav.reports", icon: "📊" },
      ]
    : [{ href: "/clubs", key: "nav.clubs", icon: "🎮" }];

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-slate-800 bg-slate-900 p-4">
      <Link href="/clubs" className="mb-6 block px-2">
        <div className="text-lg font-bold text-white">{t("app.name")}</div>
        <div className="text-xs text-slate-400">{t("app.tagline")}</div>
      </Link>

      {clubId && (
        <Link
          href="/clubs"
          className="mb-2 flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-slate-200"
        >
          ← {t("nav.clubs")}
        </Link>
      )}

      <nav className="flex flex-1 flex-col gap-1">
        {items.map((item) => {
          const active =
            pathname === item.href ||
            (item.href.endsWith(clubId ?? "___") && pathname.startsWith(item.href + "/rooms"));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                active ? "bg-brand text-white" : "text-slate-300 hover:bg-slate-800"
              }`}
            >
              <span>{item.icon}</span>
              {t(item.key)}
            </Link>
          );
        })}
      </nav>

      <div className="mt-4">
        <LanguageSwitcher />
      </div>
    </aside>
  );
}
