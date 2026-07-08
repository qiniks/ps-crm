"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import { formatMoney } from "@/lib/format";
import { fetchShifts } from "@/components/shift/ShiftCard";
import { PageHeader } from "@/components/ui-patterns/page-header";
import { ErrorState } from "@/components/ui-patterns/error-state";
import { Card } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { TranslationKey } from "@/lib/i18n/dictionaries";

type Report = {
  revenueToday: number;
  sessionsToday: number;
  avgCheck: number;
  recent: {
    id: string;
    station: string;
    tariffKind: string;
    customerName: string | null;
    endedAt: string | null;
    cost: number;
  }[];
};

async function fetchReport(clubId: string): Promise<Report> {
  const res = await fetch(`/api/clubs/${clubId}/reports`, { cache: "no-store" });
  if (!res.ok) throw new Error(`GET reports failed: ${res.status}`);
  return res.json();
}

export default function ReportsPage() {
  const { t, locale } = useI18n();
  const { clubId } = useParams<{ clubId: string }>();

  const {
    data: report,
    isLoading,
    isError,
    refetch,
  } = useQuery({ queryKey: ["reports", clubId], queryFn: () => fetchReport(clubId) });

  const { data: shifts } = useQuery({
    queryKey: ["shifts", clubId],
    queryFn: () => fetchShifts(clubId),
  });

  if (isLoading) return <div className="text-muted-foreground">{t("common.loading")}</div>;
  if (isError || !report) {
    return <ErrorState message={t("common.error")} onRetry={() => refetch()} retryLabel={t("common.retry")} />;
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title={t("reports.title")} />

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label={t("reports.revenueToday")}>
          {formatMoney(report.revenueToday)} {t("common.currency")}
        </StatCard>
        <StatCard label={t("reports.sessionsToday")}>{report.sessionsToday}</StatCard>
        <StatCard label={t("reports.avgCheck")}>
          {formatMoney(report.avgCheck)} {t("common.currency")}
        </StatCard>
      </div>

      <h2 className="mb-3 text-lg font-semibold text-foreground">{t("reports.recent")}</h2>
      <div className="overflow-hidden rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("reports.station")}</TableHead>
              <TableHead>{t("reports.tariff")}</TableHead>
              <TableHead>{t("customers.name")}</TableHead>
              <TableHead>{t("reports.amount")}</TableHead>
              <TableHead>{t("reports.when")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {report.recent.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  {t("reports.empty")}
                </TableCell>
              </TableRow>
            ) : (
              report.recent.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="text-foreground">{s.station}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {t(`tariff.${s.tariffKind}` as TranslationKey)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{s.customerName ?? "—"}</TableCell>
                  <TableCell className="text-success">
                    {formatMoney(s.cost)} {t("common.currency")}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {s.endedAt ? new Date(s.endedAt).toLocaleString(locale) : "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {shifts && shifts.history.length > 0 && (
        <>
          <h2 className="mb-3 mt-8 text-lg font-semibold text-foreground">{t("shift.history")}</h2>
          <div className="overflow-hidden rounded-xl border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("shift.openedAt")}</TableHead>
                  <TableHead>{t("shift.cashier")}</TableHead>
                  <TableHead>{t("payment.CASH")}</TableHead>
                  <TableHead>{t("payment.CARD")}</TableHead>
                  <TableHead>{t("shift.expectedCash")}</TableHead>
                  <TableHead>{t("shift.closingCash")}</TableHead>
                  <TableHead>{t("shift.difference")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shifts.history.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="text-muted-foreground">
                      {new Date(s.openedAt).toLocaleString(locale)}
                    </TableCell>
                    <TableCell className="text-foreground">{s.openedBy}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatMoney(s.cashRevenue)} {t("common.currency")}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatMoney(s.cardRevenue)} {t("common.currency")}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatMoney(s.expectedCash)} {t("common.currency")}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {s.closingCash != null ? `${formatMoney(s.closingCash)} ${t("common.currency")}` : "—"}
                    </TableCell>
                    <TableCell
                      className={cn(
                        s.difference == null || s.difference === 0
                          ? "text-muted-foreground"
                          : s.difference < 0
                          ? "text-destructive"
                          : "text-success"
                      )}
                    >
                      {s.difference == null
                        ? "—"
                        : `${s.difference > 0 ? "+" : ""}${formatMoney(s.difference)} ${t("common.currency")}`}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Card className="p-5">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-2 text-2xl font-bold text-foreground">{children}</div>
    </Card>
  );
}
