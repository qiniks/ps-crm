"use client";

import { useI18n } from "@/lib/i18n/LanguageProvider";
import { LOCALES } from "@/lib/i18n/dictionaries";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function LanguageSwitcher() {
  const { locale, setLocale } = useI18n();
  return (
    <div className="flex items-center gap-1 rounded-md bg-muted p-1">
      {LOCALES.map((l) => (
        <Button
          key={l}
          size="sm"
          variant={locale === l ? "default" : "ghost"}
          className={cn("h-7 px-2.5 text-xs font-semibold uppercase", locale !== l && "text-muted-foreground")}
          onClick={() => setLocale(l)}
        >
          {l}
        </Button>
      ))}
    </div>
  );
}
