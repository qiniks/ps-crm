"use client";

import { useI18n } from "@/lib/i18n/LanguageProvider";
import { LOCALES } from "@/lib/i18n/dictionaries";

export function LanguageSwitcher() {
  const { locale, setLocale } = useI18n();
  return (
    <div className="flex items-center gap-1 rounded-lg bg-slate-800 p-1">
      {LOCALES.map((l) => (
        <button
          key={l}
          onClick={() => setLocale(l)}
          className={`rounded-md px-2.5 py-1 text-xs font-semibold uppercase transition ${
            locale === l
              ? "bg-brand text-white"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
