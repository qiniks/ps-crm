"use client";

import { useI18n } from "@/lib/i18n/LanguageProvider";
import { formatDuration, formatMoney } from "@/lib/format";
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

  // Timer text for busy stations.
  let timer: { label: string; value: string; danger?: boolean } | null = null;
  let cost = 0;
  if (isBusy && sess) {
    const started = new Date(sess.startedAt).getTime();
    if (sess.tariffKind === "OPEN") {
      cost = Math.round(((now - started) / 3_600_000) * room.openHourlyRate);
      timer = { label: t("station.elapsed"), value: formatDuration(now - started) };
    } else if (sess.plannedEndAt) {
      const remaining = new Date(sess.plannedEndAt).getTime() - now;
      timer =
        remaining >= 0
          ? { label: t("station.remaining"), value: formatDuration(remaining) }
          : { label: t("station.overtime"), value: formatDuration(-remaining), danger: true };
    }
  }

  const color = isBusy
    ? "border-emerald-500 bg-emerald-500/15"
    : isMaint
    ? "border-amber-500 bg-amber-500/10"
    : "border-slate-600 bg-slate-800 hover:border-brand hover:bg-brand/10";

  return (
    <button
      onClick={() => !isMaint && onSelect(station)}
      disabled={isMaint}
      style={{ left: `${station.posX}%`, top: `${station.posY}%` }}
      className={`absolute w-28 -translate-x-1/2 -translate-y-1/2 rounded-xl border-2 p-2 text-center text-xs shadow-lg transition ${color} ${
        isMaint ? "cursor-not-allowed opacity-70" : "cursor-pointer"
      }`}
    >
      <div className="truncate font-semibold text-white">{station.name}</div>
      <div className="text-[10px] text-slate-400">{station.type}</div>

      {isBusy && sess ? (
        <div className="mt-1 space-y-0.5">
          <div className="text-[10px] text-slate-300">
            {t(`tariff.${sess.tariffKind}` as TranslationKey)}
          </div>
          {timer && (
            <div
              className={`font-mono text-sm tabular-nums ${
                timer.danger ? "text-rose-400" : "text-white"
              }`}
            >
              {timer.value}
            </div>
          )}
          {sess.tariffKind === "OPEN" && (
            <div className="text-[11px] font-semibold text-emerald-300">
              {formatMoney(cost)} {t("common.currency")}
            </div>
          )}
          {sess.customerName && (
            <div className="truncate text-[10px] text-slate-400">👤 {sess.customerName}</div>
          )}
        </div>
      ) : (
        <div className="mt-1 text-[11px] font-medium text-slate-300">
          {isMaint ? t("station.maintenance") : t("station.free")}
        </div>
      )}
    </button>
  );
}
