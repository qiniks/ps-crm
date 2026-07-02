"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import { formatMoney } from "@/lib/format";
import { TARIFFS, fixedPrice, type TariffKind } from "@/lib/tariffs";
import type { RoomDTO, StationDTO } from "@/lib/room-types";
import type { TranslationKey } from "@/lib/i18n/dictionaries";

type Customer = { id: string; name: string };

export function BookingModal({
  room,
  station,
  onClose,
  onBooked,
}: {
  room: RoomDTO;
  station: StationDTO;
  onClose: () => void;
  onBooked: () => void;
}) {
  const { t } = useI18n();
  const [tariff, setTariff] = useState<TariffKind>("HOUR_1");
  const [customerId, setCustomerId] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`/api/clubs/${room.club.id}/customers`, { cache: "no-store" })
      .then((r) => r.json())
      .then(setCustomers)
      .catch(() => setCustomers([]));
  }, [room.club.id]);

  async function confirm() {
    setBusy(true);
    await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        stationId: station.id,
        tariffKind: tariff,
        customerId: customerId || undefined,
      }),
    });
    setBusy(false);
    onBooked();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 text-xs uppercase tracking-wide text-slate-400">
          {t("booking.station")}
        </div>
        <h2 className="mb-5 text-xl font-bold text-white">
          {station.name} <span className="text-sm text-slate-400">· {station.type}</span>
        </h2>

        <div className="mb-2 text-sm font-medium text-slate-300">
          {t("booking.chooseTariff")}
        </div>
        <div className="mb-5 grid grid-cols-2 gap-3">
          {TARIFFS.map(({ kind }) => {
            const price = fixedPrice(room, kind);
            const active = tariff === kind;
            return (
              <button
                key={kind}
                onClick={() => setTariff(kind)}
                className={`rounded-xl border p-3 text-left transition ${
                  active
                    ? "border-brand bg-brand/10"
                    : "border-slate-700 hover:border-slate-500"
                }`}
              >
                <div className="font-semibold text-white">
                  {t(`tariff.${kind}` as TranslationKey)}
                </div>
                <div className="text-sm text-emerald-300">
                  {price === null
                    ? `${formatMoney(room.openHourlyRate)} ${t("common.currency")}${t("common.perHour")}`
                    : `${formatMoney(price)} ${t("common.currency")}`}
                </div>
              </button>
            );
          })}
        </div>

        <label className="mb-5 block">
          <span className="mb-1 block text-sm font-medium text-slate-300">
            {t("booking.customer")}
          </span>
          <select
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-brand"
          >
            <option value="">{t("booking.customerNone")}</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <div className="flex gap-2">
          <button
            onClick={confirm}
            disabled={busy}
            className="flex-1 rounded-lg bg-brand py-2.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50"
          >
            {t("booking.confirm")}
          </button>
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2.5 text-sm text-slate-400 hover:text-white"
          >
            {t("common.cancel")}
          </button>
        </div>
      </div>
    </div>
  );
}
