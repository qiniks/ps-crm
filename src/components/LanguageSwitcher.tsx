"use client";

import { useI18n } from "@/lib/i18n/LanguageProvider";
import { LOCALES, type Locale } from "@/lib/i18n/dictionaries";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const LOCALE_FLAGS: Record<Locale, { flag: string; label: string }> = {
  ru: { flag: "🇷🇺", label: "Русский" },
  en: { flag: "🇬🇧", label: "English" },
};

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n();
  return (
    <div className="flex items-center gap-1 rounded-md bg-muted p-1" role="group" aria-label={t("lang.switch")}>
      {LOCALES.map((l) => (
        <Button
          key={l}
          type="button"
          size="sm"
          variant={locale === l ? "default" : "ghost"}
          className={cn("h-7 w-9 px-0 text-base", locale !== l && "opacity-60 hover:opacity-100")}
          onClick={() => setLocale(l)}
          aria-label={LOCALE_FLAGS[l].label}
          aria-pressed={locale === l}
          title={LOCALE_FLAGS[l].label}
        >
          <span aria-hidden="true">{LOCALE_FLAGS[l].flag}</span>
        </Button>
      ))}
    </div>
  );
}
