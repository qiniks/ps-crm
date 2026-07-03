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

function getSavedLocale(): Locale {
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  const saved = localStorage.getItem(STORAGE_KEY) as Locale | null;
  if (saved && (saved === "ru" || saved === "en")) return saved;
  return DEFAULT_LOCALE;
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(getSavedLocale);

  // Update document language when locale changes
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

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
