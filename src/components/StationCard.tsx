"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import { formatDuration, formatMoney } from "@/lib/format";

export type StationDTO = {
  id: string;
  name: string;
  type: string;
  status: string;
  hourlyRate: number;
  activeSession: {
    id: string;
    startedAt: string;
    customerName: string | null;
  } | null;
};

export function StationCard({
  station,
  onChanged,
}: {
  station: StationDTO;
  onChanged: () => void;
}) {
  const { t } = useI18n();
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);

  // Tick every second while a session is active so the timer is live.
  useEffect(() => {
    if (!station.activeSession) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [station.activeSession]);

  const isBusy = station.status === "BUSY" && station.activeSession;
  const startedMs = station.activeSession
    ? new Date(station.activeSession.startedAt).getTime()
    : 0;
  const elapsedMs = isBusy ? now - startedMs : 0;
  const liveCost = isBusy
    ? Math.round((elapsedMs / 3_600_000) * station.hourlyRate)
    : 0;

  async function start() {
    setBusy(true);
    await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stationId: station.id }),
    });
    setBusy(false);
    onChanged();
  }

  async function stop() {
    if (!station.activeSession) return;
    setBusy(true);
    await fetch(`/api/sessions/${station.activeSession.id}/stop`, {
      method: "POST",
    });
    setBusy(false);
    onChanged();
  }

  return (
    <div
      className={`rounded-xl border p-4 transition ${
        isBusy
          ? "border-emerald-500/40 bg-emerald-500/5"
          : "border-slate-800 bg-slate-900"
      }`}
    >
      <div className="mb-3 flex items-start justify-between">
        <div>
          <div className="font-semibold text-white">{station.name}</div>
          <div className="text-xs text-slate-400">{station.type}</div>
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            isBusy
              ? "bg-emerald-500/20 text-emerald-300"
              : station.status === "MAINTENANCE"
              ? "bg-amber-500/20 text-amber-300"
              : "bg-slate-700 text-slate-300"
          }`}
        >
          {isBusy
            ? t("dashboard.busy")
            : station.status === "MAINTENANCE"
            ? t("dashboard.maintenance")
            : t("dashboard.free")}
        </span>
      </div>

      {isBusy ? (
        <div className="space-y-1 text-sm">
          {station.activeSession?.customerName && (
            <div className="text-slate-300">
              👤 {station.activeSession.customerName}
            </div>
          )}
          <div className="flex justify-between text-slate-300">
            <span>{t("station.elapsed")}</span>
            <span className="font-mono tabular-nums text-white">
              {formatDuration(elapsedMs)}
            </span>
          </div>
          <div className="flex justify-between text-slate-300">
            <span>{t("station.cost")}</span>
            <span className="font-semibold text-emerald-300">
              {formatMoney(liveCost)} {t("common.currency")}
            </span>
          </div>
        </div>
      ) : (
        <div className="text-sm text-slate-500">
          {formatMoney(station.hourlyRate)} {t("common.currency")}
          {t("station.perHour")}
        </div>
      )}

      <button
        onClick={isBusy ? stop : start}
        disabled={busy || station.status === "MAINTENANCE"}
        className={`mt-4 w-full rounded-lg py-2 text-sm font-semibold transition disabled:opacity-50 ${
          isBusy
            ? "bg-rose-600 hover:bg-rose-500 text-white"
            : "bg-brand hover:bg-brand-dark text-white"
        }`}
      >
        {isBusy ? t("station.stop") : t("station.start")}
      </button>
    </div>
  );
}
