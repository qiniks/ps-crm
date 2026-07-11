"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { IconChartHistogram } from "@tabler/icons-react";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import { formatMoney } from "@/lib/format";
import { ColumnChart, BarList } from "@/components/analytics/charts";
import { PageHeader } from "@/components/ui-patterns/page-header";
import { EmptyState } from "@/components/ui-patterns/empty-state";
import { ErrorState } from "@/components/ui-patterns/error-state";
import {
  DateRangePicker,
  dateRangeSearchParams,
  defaultDateRangeValue,
  type DateRangeValue,
} from "@/components/ui-patterns/date-range-picker";
import { Card } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import type { TranslationKey } from "@/lib/i18n/dictionaries";

type Analytics = {
  totals: {
    revenue: number;
    sessionsCount: number;
    avgCheck: number;
    avgDurationMin: number;
    activeNow: number;
  };
  byHour: number[];
  byWeekday: number[];
  byTariff: { kind: string; count: number; revenue: number }[];
  byRoom: { name: string; count: number; revenue: number }[];
  byDay: { date: string; revenue: number; count: number }[];
  topCustomers: { name: string; count: number; revenue: number }[];
};

async function fetchAnalytics(clubId: string, range: DateRangeValue): Promise<Analytics> {
  const params = dateRangeSearchParams(range);
  const res = await fetch(`/api/clubs/${clubId}/analytics?${params}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`GET analytics failed: ${res.status}`);
  return res.json();
}

// 2024-01-01 is a Monday; used only to render localized weekday names.
const MONDAY = new Date(2024, 0, 1);

export default function AnalyticsPage() {
  const { t, locale } = useI18n();
  const { clubId } = useParams<{ clubId: string }>();
  const [range, setRange] = useState<DateRangeValue>(() => defaultDateRangeValue("month"));

  const {
    data,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["analytics", clubId, range.preset, range.from, range.to],
    queryFn: () => fetchAnalytics(clubId, range),
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl">
        <PageHeader title={t("analytics.title")} actions={<DateRangePicker value={range} onChange={setRange} />} />
        <div className="text-muted-foreground">{t("common.loading")}</div>
      </div>
    );
  }
  if (isError || !data) {
    return (
      <div className="mx-auto max-w-6xl">
        <PageHeader title={t("analytics.title")} actions={<DateRangePicker value={range} onChange={setRange} />} />
        <ErrorState message={t("common.error")} onRetry={() => refetch()} retryLabel={t("common.retry")} />
      </div>
    );
  }

  const money = (v: number) => `${formatMoney(v)} ${t("common.currency")}`;
  const sessionsWord = t("analytics.sessions");

  const hourColumns = data.byHour.map((value, h) => ({
    key: `h${h}`,
    label: h % 6 === 0 ? String(h) : "",
    value,
    tooltip: `${String(h).padStart(2, "0")}:00–${String((h + 1) % 24).padStart(2, "0")}:00 · ${value} ${sessionsWord}`,
  }));

  const weekdayColumns = data.byWeekday.map((value, i) => {
    const name = new Date(MONDAY.getFullYear(), MONDAY.getMonth(), MONDAY.getDate() + i)
      .toLocaleDateString(locale, { weekday: "short" });
    return { key: `w${i}`, label: name, value, tooltip: `${name} · ${value} ${sessionsWord}` };
  });

  const dayColumns = data.byDay.map((d, i) => {
    const date = new Date(`${d.date}T00:00:00`);
    return {
      key: d.date,
      label: i % 2 === 0 ? String(date.getDate()) : "",
      value: d.revenue,
      valueLabel: money(d.revenue),
      tooltip: `${date.toLocaleDateString(locale, { day: "numeric", month: "short" })} · ${money(d.revenue)} · ${d.count} ${sessionsWord}`,
    };
  });

  const tariffRows = data.byTariff.map((tr) => ({
    key: tr.kind,
    label: t(`tariff.${tr.kind}` as TranslationKey),
    value: tr.count,
    valueLabel: `${tr.count} ${sessionsWord}`,
    sublabel: money(tr.revenue),
  }));

  const roomRows = data.byRoom.map((r) => ({
    key: r.name,
    label: r.name,
    value: r.revenue,
    valueLabel: money(r.revenue),
    sublabel: `${r.count} ${sessionsWord}`,
  }));

  const hasData = data.totals.sessionsCount > 0;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={t("analytics.title")}
        subtitle={t("analytics.subtitle")}
        actions={<DateRangePicker value={range} onChange={setRange} />}
      />

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={t("analytics.revenueTotal")}>{money(data.totals.revenue)}</StatCard>
        <StatCard label={t("analytics.sessionsTotal")} sub={`${t("analytics.avgDuration")}: ${data.totals.avgDurationMin} ${t("analytics.minutes")}`}>
          {data.totals.sessionsCount}
        </StatCard>
        <StatCard label={t("reports.avgCheck")}>{money(data.totals.avgCheck)}</StatCard>
        <StatCard label={t("analytics.activeNow")}>{data.totals.activeNow}</StatCard>
      </div>

      {!hasData ? (
        <EmptyState icon={<IconChartHistogram className="h-8 w-8" />} message={t("analytics.empty")} />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <ChartCard title={t("analytics.peakHours")} hint={t("analytics.peakHoursHint")}>
            <ColumnChart columns={hourColumns} />
          </ChartCard>

          <ChartCard title={t("analytics.byWeekday")} hint={t("analytics.byWeekdayHint")}>
            <ColumnChart columns={weekdayColumns} />
          </ChartCard>

          <ChartCard title={t("analytics.revenueByDay")} hint={t("analytics.revenueByDayHint")} className="lg:col-span-2">
            <ColumnChart columns={dayColumns} />
          </ChartCard>

          <ChartCard title={t("analytics.popularTariffs")}>
            <BarList rows={tariffRows} />
          </ChartCard>

          <ChartCard title={t("analytics.popularRooms")}>
            <BarList rows={roomRows} />
          </ChartCard>

          {data.topCustomers.length > 0 && (
            <div className="lg:col-span-2">
              <h2 className="mb-3 text-lg font-semibold text-foreground">{t("analytics.topCustomers")}</h2>
              <div className="overflow-hidden rounded-xl border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("customers.name")}</TableHead>
                      <TableHead>{t("analytics.sessionsHeader")}</TableHead>
                      <TableHead>{t("analytics.revenue")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.topCustomers.map((c) => (
                      <TableRow key={c.name}>
                        <TableCell className="text-foreground">{c.name}</TableCell>
                        <TableCell className="text-muted-foreground">{c.count}</TableCell>
                        <TableCell className="text-success">{money(c.revenue)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, sub, children }: { label: string; sub?: string; children: React.ReactNode }) {
  return (
    <Card className="p-5">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-2 text-2xl font-bold text-foreground">{children}</div>
      {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
    </Card>
  );
}

function ChartCard({
  title,
  hint,
  className,
  children,
}: {
  title: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className={`p-5 ${className ?? ""}`}>
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </Card>
  );
}
