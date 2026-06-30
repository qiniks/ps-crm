"use client";

import { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import { StationCard, type StationDTO } from "@/components/StationCard";

export default function DashboardPage() {
  const { t } = useI18n();
  const [stations, setStations] = useState<StationDTO[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await fetch("/api/stations", { cache: "no-store" });
    const data = await res.json();
    setStations(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    // Light polling keeps multiple cashier screens roughly in sync.
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, [load]);

  const activeCount = stations.filter((s) => s.activeSession).length;

  return (
    <div>
      <header className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{t("dashboard.title")}</h1>
          <p className="text-sm text-slate-400">{t("dashboard.subtitle")}</p>
        </div>
      </header>

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Stat label={t("dashboard.total")} value={stations.length} />
        <Stat label={t("dashboard.active")} value={activeCount} accent />
        <Stat
          label={t("dashboard.free")}
          value={stations.filter((s) => s.status === "FREE").length}
        />
      </div>

      {loading ? (
        <div className="text-slate-400">{t("common.loading")}</div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {stations.map((s) => (
            <StationCard key={s.id} station={s} onChanged={load} />
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
      <div className="text-xs uppercase tracking-wide text-slate-400">{label}</div>
      <div
        className={`mt-1 text-3xl font-bold ${
          accent ? "text-emerald-400" : "text-white"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
