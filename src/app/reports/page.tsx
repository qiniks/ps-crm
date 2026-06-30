"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import { formatDuration, formatMoney } from "@/lib/format";

type Report = {
  revenueToday: number;
  sessionsToday: number;
  avgCheck: number;
  recent: {
    id: string;
    station: string;
    customerName: string | null;
    startedAt: string;
    endedAt: string | null;
    cost: number;
  }[];
};

export default function ReportsPage() {
  const { t, locale } = useI18n();
  const [report, setReport] = useState<Report | null>(null);

  useEffect(() => {
    fetch("/api/reports", { cache: "no-store" })
      .then((r) => r.json())
      .then(setReport);
  }, []);

  if (!report) {
    return <div className="text-slate-400">{t("common.loading")}</div>;
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-white">{t("reports.title")}</h1>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card label={t("reports.revenueToday")}>
          {formatMoney(report.revenueToday)} {t("common.currency")}
        </Card>
        <Card label={t("reports.sessionsToday")}>{report.sessionsToday}</Card>
        <Card label={t("reports.avgCheck")}>
          {formatMoney(report.avgCheck)} {t("common.currency")}
        </Card>
      </div>

      <h2 className="mb-3 text-lg font-semibold text-white">{t("reports.recent")}</h2>
      <div className="overflow-hidden rounded-xl border border-slate-800">
        <table className="w-full text-sm">
          <thead className="bg-slate-900 text-left text-slate-400">
            <tr>
              <th className="px-4 py-3 font-medium">{t("reports.station")}</th>
              <th className="px-4 py-3 font-medium">{t("customers.name")}</th>
              <th className="px-4 py-3 font-medium">{t("reports.duration")}</th>
              <th className="px-4 py-3 font-medium">{t("reports.amount")}</th>
              <th className="px-4 py-3 font-medium">{t("reports.when")}</th>
            </tr>
          </thead>
          <tbody>
            {report.recent.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                  {t("reports.empty")}
                </td>
              </tr>
            ) : (
              report.recent.map((s) => {
                const dur =
                  s.endedAt && s.startedAt
                    ? new Date(s.endedAt).getTime() - new Date(s.startedAt).getTime()
                    : 0;
                return (
                  <tr key={s.id} className="border-t border-slate-800">
                    <td className="px-4 py-3 text-white">{s.station}</td>
                    <td className="px-4 py-3 text-slate-300">
                      {s.customerName ?? "—"}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-300">
                      {formatDuration(dur)}
                    </td>
                    <td className="px-4 py-3 text-emerald-300">
                      {formatMoney(s.cost)} {t("common.currency")}
                    </td>
                    <td className="px-4 py-3 text-slate-400">
                      {s.endedAt
                        ? new Date(s.endedAt).toLocaleString(locale)
                        : "—"}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Card({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
      <div className="text-xs uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-2 text-2xl font-bold text-white">{children}</div>
    </div>
  );
}
