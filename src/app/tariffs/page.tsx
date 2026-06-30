"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import { formatMoney } from "@/lib/format";

type Tariff = {
  id: string;
  name: string;
  pricePerHour: number;
  isDefault: boolean;
};

export default function TariffsPage() {
  const { t } = useI18n();
  const [tariffs, setTariffs] = useState<Tariff[]>([]);

  useEffect(() => {
    fetch("/api/tariffs", { cache: "no-store" })
      .then((r) => r.json())
      .then(setTariffs);
  }, []);

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-white">{t("tariffs.title")}</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tariffs.map((tar) => (
          <div
            key={tar.id}
            className="rounded-xl border border-slate-800 bg-slate-900 p-5"
          >
            <div className="flex items-center justify-between">
              <div className="font-semibold text-white">{tar.name}</div>
              {tar.isDefault && (
                <span className="rounded-full bg-brand/20 px-2 py-0.5 text-xs text-brand">
                  {t("tariffs.default")}
                </span>
              )}
            </div>
            <div className="mt-3 text-3xl font-bold text-white">
              {formatMoney(tar.pricePerHour)}
              <span className="ml-1 text-base font-normal text-slate-400">
                {t("common.currency")}/{t("common.minutes") === "min" ? "hr" : "час"}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
