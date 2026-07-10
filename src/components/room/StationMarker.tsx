"use client";

import { IconAlertTriangle, IconUser } from "@tabler/icons-react";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import { formatDuration, formatMoney } from "@/lib/format";
import { isSessionEndingSoon, liveCost } from "@/lib/tariffs";
import { cn } from "@/lib/utils";
import type { RoomDTO, StationDTO } from "@/lib/room-types";
import type { TranslationKey } from "@/lib/i18n/dictionaries";

// A console shown on the room floor plan (booking/view mode).
export function StationMarker({
  station,
  room,
  now,
  onSelect,
}: {
  station: StationDTO;
  room: RoomDTO;
  now: number;
  onSelect: (s: StationDTO) => void;
}) {
  const { t } = useI18n();
  const sess = station.activeSession;
  const isBusy = station.status === "BUSY" && sess;
  const isMaint = station.status === "MAINTENANCE";

  // Timer text for busy stations, plus a distinct "ending soon" state for
  // fixed-tariff sessions approaching their planned end (before they flip to
  // the already-established overtime treatment).
  let timer: { label: string; value: string; state?: "endingSoon" | "overtime" } | null = null;
  let cost = 0;
  let endingSoon = false;
  if (isBusy && sess) {
    const started = new Date(sess.startedAt).getTime();
    if (sess.tariffKind === "OPEN") {
      cost = liveCost(sess, room, now);
      timer = { label: t("station.elapsed"), value: formatDuration(now - started) };
    } else if (sess.plannedEndAt) {
      const remaining = new Date(sess.plannedEndAt).getTime() - now;
      if (remaining >= 0) {
        endingSoon = isSessionEndingSoon(sess.plannedEndAt, now);
        timer = {
          label: endingSoon ? t("station.endingSoon") : t("station.remaining"),
          value: formatDuration(remaining),
          state: endingSoon ? "endingSoon" : undefined,
        };
      } else {
        timer = { label: t("station.overtime"), value: formatDuration(-remaining), state: "overtime" };
      }
    }
  }

  return (
    <button
      onClick={() => !isMaint && onSelect(station)}
      disabled={isMaint}
      style={{ left: `${station.posX}%`, top: `${station.posY}%` }}
      className={cn(
        "absolute w-28 -translate-x-1/2 -translate-y-1/2 rounded-xl border-2 p-2 text-center text-xs shadow-lg transition",
        isBusy
          ? endingSoon
            ? "border-warning bg-warning/15"
            : "border-success bg-success/15"
          : isMaint
          ? "cursor-not-allowed border-warning bg-warning/10 opacity-70"
          : "cursor-pointer border-border bg-card hover:border-primary hover:bg-primary/10"
      )}
    >
      <div className="truncate font-semibold text-foreground">{station.name}</div>
      <div className="text-[10px] text-muted-foreground">{station.type}</div>

      {isBusy && sess ? (
        <div className="mt-1 space-y-0.5">
          <div className="text-[10px] text-muted-foreground">
            {t(`tariff.${sess.tariffKind}` as TranslationKey)}
          </div>
          {timer && (
            <div
              className={cn(
                "flex items-center justify-center gap-1 font-mono text-sm tabular-nums",
                timer.state === "overtime"
                  ? "text-destructive"
                  : timer.state === "endingSoon"
                  ? "text-warning"
                  : "text-foreground"
              )}
            >
              {timer.state === "endingSoon" && <IconAlertTriangle className="h-3 w-3 shrink-0" />}
              {timer.value}
            </div>
          )}
          {sess.tariffKind === "OPEN" && (
            <div className="text-[11px] font-semibold text-success">
              {formatMoney(cost)} {t("common.currency")}
            </div>
          )}
          {sess.customerName && (
            <div className="flex items-center justify-center gap-1 truncate text-[10px] text-muted-foreground">
              <IconUser className="h-3 w-3" />
              {sess.customerName}
            </div>
          )}
        </div>
      ) : (
        <div className="mt-1 text-[11px] font-medium text-muted-foreground">
          {isMaint ? t("station.maintenance") : t("station.free")}
        </div>
      )}
    </button>
  );
}
