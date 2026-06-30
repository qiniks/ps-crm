"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import { LanguageSwitcher } from "./LanguageSwitcher";
import type { TranslationKey } from "@/lib/i18n/dictionaries";

const NAV: { href: string; key: TranslationKey; icon: string }[] = [
  { href: "/dashboard", key: "nav.dashboard", icon: "🎮" },
  { href: "/customers", key: "nav.customers", icon: "👥" },
  { href: "/tariffs", key: "nav.tariffs", icon: "💵" },
  { href: "/reports", key: "nav.reports", icon: "📊" },
];

export function Sidebar() {
  const pathname = usePathname();
  const { t } = useI18n();

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-slate-800 bg-slate-900 p-4">
      <div className="mb-6 px-2">
        <div className="text-lg font-bold text-white">{t("app.name")}</div>
        <div className="text-xs text-slate-400">{t("app.tagline")}</div>
      </div>

      <nav className="flex flex-1 flex-col gap-1">
        {NAV.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                active
                  ? "bg-brand text-white"
                  : "text-slate-300 hover:bg-slate-800"
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
