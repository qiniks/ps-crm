"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import {
  dictionaries,
  DEFAULT_LOCALE,
  type Locale,
  type TranslationKey,
} from "./dictionaries";

type Ctx = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: TranslationKey) => string;
};

const LanguageContext = createContext<Ctx | null>(null);

const STORAGE_KEY = "ps-crm.locale";

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  // Restore saved choice on mount.
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as Locale | null;
    // TODO(2026-07-02-tanstack-query-migration.md): deferred localStorage read intentionally avoids a hydration mismatch; suppressing the new rule here rather than hand-restructuring ahead of that plan.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved && (saved === "ru" || saved === "en")) setLocaleState(saved);
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    localStorage.setItem(STORAGE_KEY, l);
    document.documentElement.lang = l;
  }, []);

  const t = useCallback(
    (key: TranslationKey) => dictionaries[locale][key] ?? key,
    [locale]
  );

  return (
    <LanguageContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useI18n must be used within LanguageProvider");
  return ctx;
}
