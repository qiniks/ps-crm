"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { IconAlertTriangle, IconCashRegister } from "@tabler/icons-react";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import { useNow } from "@/lib/useNow";
import { formatMoney } from "@/lib/format";
import { isShiftOpenTooLong, PAYMENT_METHODS, type PaymentBreakdown } from "@/lib/shifts";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { TranslationKey } from "@/lib/i18n/dictionaries";

export type ShiftDTO = {
  id: string;
  openedBy: string;
  openedAt: string;
  closedAt: string | null;
  openingCash: number;
  closingCash: number | null;
  status: "OPEN" | "CLOSED";
  expectedCash: number;
  difference: number | null;
  cashRevenue: number;
  cardRevenue: number;
  sessionsCount: number;
};

export type ShiftsResponse = { current: ShiftDTO | null; history: ShiftDTO[] };

export type ShiftCloseSummary = {
  id: string;
  openedBy: string;
  openedAt: string;
  closedAt: string | null;
  openingCash: number;
  closingCash: number;
  expectedCash: number;
  difference: number;
  paymentBreakdown: PaymentBreakdown;
  sessionsCount: number;
};

export async function fetchShifts(clubId: string): Promise<ShiftsResponse> {
  const res = await fetch(`/api/clubs/${clubId}/shifts`, { cache: "no-store" });
  if (!res.ok) throw new Error(`GET shifts failed: ${res.status}`);
  return res.json();
}

async function openShiftRequest(clubId: string, openingCash: number) {
  const res = await fetch(`/api/clubs/${clubId}/shifts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ openingCash }),
  });
  if (!res.ok) throw new Error(`POST shift failed: ${res.status}`);
  return res.json();
}

async function closeShiftRequest(shiftId: string, closingCash: number): Promise<ShiftCloseSummary> {
  const res = await fetch(`/api/shifts/${shiftId}/close`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ closingCash }),
  });
  if (!res.ok) throw new Error(`POST close failed: ${res.status}`);
  return res.json();
}

export function ShiftCard({ clubId }: { clubId: string }) {
  const { t, locale } = useI18n();
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState<"open" | "close" | null>(null);
  const [cashInput, setCashInput] = useState("");
  const [handoverSummary, setHandoverSummary] = useState<ShiftCloseSummary | null>(null);
  // Minute-granularity clock is enough for a multi-hour "open too long" threshold.
  const now = useNow(60_000);

  const { data } = useQuery({ queryKey: ["shifts", clubId], queryFn: () => fetchShifts(clubId) });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["shifts", clubId] });
    setDialog(null);
    setCashInput("");
  };
  const openMutation = useMutation({
    mutationFn: (openingCash: number) => openShiftRequest(clubId, openingCash),
    onSuccess: invalidate,
  });
  const closeMutation = useMutation({
    mutationFn: ({ shiftId, closingCash }: { shiftId: string; closingCash: number }) =>
      closeShiftRequest(shiftId, closingCash),
    onSuccess: (summary) => {
      invalidate();
      setHandoverSummary(summary);
    },
  });

  const money = (v: number) => `${formatMoney(v)} ${t("common.currency")}`;
  const current = data?.current ?? null;
  const counted = Math.round(Number(cashInput) || 0);
  const liveDiff = current ? counted - current.expectedCash : 0;
  const openTooLong = current ? isShiftOpenTooLong(current.openedAt, now) : false;

  return (
    <Card className="mb-6 p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <IconCashRegister className="h-6 w-6 text-primary" />
          <div>
            <div className="flex items-center gap-2 font-semibold text-foreground">
              {t("shift.title")}
              {current ? (
                <Badge
                  className={cn(
                    openTooLong
                      ? "bg-warning text-warning-foreground hover:bg-warning"
                      : "bg-success text-success-foreground hover:bg-success"
                  )}
                >
                  {t("shift.openBadge")}
                </Badge>
              ) : (
                <Badge variant="secondary">{t("shift.closedBadge")}</Badge>
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              {current
                ? `${current.openedBy} · ${new Date(current.openedAt).toLocaleString(locale)}`
                : t("shift.noOpenHint")}
            </div>
            {openTooLong && (
              <div className="mt-0.5 flex items-center gap-1 text-xs font-medium text-warning">
                <IconAlertTriangle className="h-3.5 w-3.5" />
                {t("shift.openTooLong")}
              </div>
            )}
          </div>
        </div>

        {current && (
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
            <ShiftStat label={t("shift.expectedCash")} value={money(current.expectedCash)} />
            <ShiftStat label={t("payment.CASH")} value={money(current.cashRevenue)} />
            <ShiftStat label={t("payment.CARD")} value={money(current.cardRevenue)} />
            <ShiftStat label={t("shift.sessions")} value={String(current.sessionsCount)} />
          </div>
        )}

        {current ? (
          <Button variant="outline" onClick={() => setDialog("close")}>
            {t("shift.close")}
          </Button>
        ) : (
          <Button onClick={() => setDialog("open")}>{t("shift.open")}</Button>
        )}
      </div>

      <Dialog open={dialog !== null} onOpenChange={(v) => !v && setDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{dialog === "open" ? t("shift.open") : t("shift.close")}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (dialog === "open") openMutation.mutate(counted);
              else if (current) closeMutation.mutate({ shiftId: current.id, closingCash: counted });
            }}
            className="flex flex-col gap-4"
          >
            {dialog === "close" && current && (
              <div className="flex justify-between rounded-lg bg-muted p-3 text-sm">
                <span className="text-muted-foreground">{t("shift.expectedCash")}</span>
                <span className="font-semibold text-foreground">{money(current.expectedCash)}</span>
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="shift-cash">
                {dialog === "open" ? t("shift.openingCash") : t("shift.closingCash")}
              </Label>
              <Input
                id="shift-cash"
                type="number"
                min="0"
                value={cashInput}
                onChange={(e) => setCashInput(e.target.value)}
                placeholder="0"
                autoFocus
              />
            </div>
            {dialog === "close" && current && cashInput !== "" && liveDiff !== 0 && (
              <div
                className={cn(
                  "text-sm font-medium",
                  liveDiff < 0 ? "text-destructive" : "text-success"
                )}
              >
                {t("shift.difference")}: {liveDiff > 0 ? "+" : ""}
                {money(liveDiff)}
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setDialog(null)}>
                {t("common.cancel")}
              </Button>
              <Button disabled={openMutation.isPending || closeMutation.isPending}>
                {t("common.confirm")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={handoverSummary !== null} onOpenChange={(v) => !v && setHandoverSummary(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("shift.handoverTitle")}</DialogTitle>
          </DialogHeader>
          {handoverSummary && (
            <div className="flex flex-col gap-4">
              <div className="text-sm text-muted-foreground">
                {handoverSummary.openedBy}
                {" · "}
                {t("shift.openedAt")} {new Date(handoverSummary.openedAt).toLocaleString(locale)}
                {handoverSummary.closedAt && (
                  <>
                    {" · "}
                    {t("shift.closedAt")} {new Date(handoverSummary.closedAt).toLocaleString(locale)}
                  </>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 rounded-lg bg-muted p-3 text-sm">
                <ShiftStat label={t("shift.openingCash")} value={money(handoverSummary.openingCash)} />
                <ShiftStat label={t("shift.closingCash")} value={money(handoverSummary.closingCash)} />
                <ShiftStat label={t("shift.expectedCash")} value={money(handoverSummary.expectedCash)} />
                <div>
                  <div className="text-xs text-muted-foreground">{t("shift.difference")}</div>
                  <div
                    className={cn(
                      "font-semibold",
                      handoverSummary.difference === 0
                        ? "text-foreground"
                        : handoverSummary.difference < 0
                        ? "text-destructive"
                        : "text-success"
                    )}
                  >
                    {handoverSummary.difference > 0 ? "+" : ""}
                    {money(handoverSummary.difference)}
                  </div>
                </div>
              </div>

              <div>
                <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t("shift.paymentBreakdown")}
                </div>
                <div className="flex flex-col gap-1.5">
                  {PAYMENT_METHODS.map((method) => (
                    <div key={method} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{t(`payment.${method}` as TranslationKey)}</span>
                      <span className="font-medium text-foreground">
                        {handoverSummary.paymentBreakdown[method].count} ·{" "}
                        {money(handoverSummary.paymentBreakdown[method].total)}
                      </span>
                    </div>
                  ))}
                  <div className="mt-1 flex items-center justify-between border-t border-border pt-1.5 text-sm font-semibold text-foreground">
                    <span>{t("shift.sessions")}</span>
                    <span>{handoverSummary.sessionsCount}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="print:hidden">
            <Button type="button" variant="ghost" onClick={() => setHandoverSummary(null)}>
              {t("common.close")}
            </Button>
            <Button type="button" onClick={() => window.print()}>
              {t("common.print")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function ShiftStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-semibold text-foreground">{value}</div>
    </div>
  );
}
