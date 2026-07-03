"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import { formatMoney } from "@/lib/format";

type Room = {
  id: string;
  name: string;
  price1h: number;
  price3h: number;
  price5h: number;
  openHourlyRate: number;
  stationCount: number;
};

const EMPTY = { name: "", price1h: "", price3h: "", price5h: "", openHourlyRate: "" };

export default function ClubPage() {
  const { t } = useI18n();
  const { clubId } = useParams<{ clubId: string }>();
  const [clubName, setClubName] = useState("");
  const [rooms, setRooms] = useState<Room[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/clubs/${clubId}/rooms`, { cache: "no-store" });
    const data = await res.json();
    setClubName(data.club?.name ?? "");
    setRooms(data.rooms ?? []);
  }, [clubId]);

  useEffect(() => {
    // TODO(2026-07-02-tanstack-query-migration.md): this fetch pattern is replaced by useQuery in that plan; suppressing the new rule here rather than hand-restructuring ahead of it.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    await fetch(`/api/clubs/${clubId}/rooms`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setForm(EMPTY);
    setShowForm(false);
    load();
  }

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{clubName}</h1>
          <p className="text-sm text-slate-400">{t("club.rooms")}</p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark"
        >
          + {t("club.addRoom")}
        </button>
      </header>

      {showForm && (
        <form
          onSubmit={create}
          className="mb-8 rounded-xl border border-slate-800 bg-slate-900 p-5"
        >
          <input
            value={form.name}
            onChange={set("name")}
            placeholder={t("club.roomName")}
            className="mb-4 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-brand"
          />
          <div className="mb-1 text-xs uppercase tracking-wide text-slate-400">
            {t("room.pricing")} ({t("common.currency")})
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <PriceInput label={t("room.price1h")} value={form.price1h} onChange={set("price1h")} />
            <PriceInput label={t("room.price3h")} value={form.price3h} onChange={set("price3h")} />
            <PriceInput label={t("room.price5h")} value={form.price5h} onChange={set("price5h")} />
            <PriceInput
              label={t("room.priceOpen")}
              value={form.openHourlyRate}
              onChange={set("openHourlyRate")}
            />
          </div>
          <div className="mt-4 flex gap-2">
            <button className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark">
              {t("common.create")}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-lg px-4 py-2 text-sm text-slate-400 hover:text-white"
            >
              {t("common.cancel")}
            </button>
          </div>
        </form>
      )}

      {rooms.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-700 p-10 text-center text-slate-500">
          {t("club.noRooms")}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {rooms.map((r) => (
            <div key={r.id} className="rounded-xl border border-slate-800 bg-slate-900 p-5">
              <div className="flex items-center justify-between">
                <div className="font-semibold text-white">{r.name}</div>
                <div className="text-sm text-slate-400">
                  🎮 {r.stationCount} {t("club.stationsCount")}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
                <span>1h: {formatMoney(r.price1h)}</span>
                <span>3h: {formatMoney(r.price3h)}</span>
                <span>5h: {formatMoney(r.price5h)}</span>
                <span>
                  {t("station.openTariff")}: {formatMoney(r.openHourlyRate)}
                  {t("common.perHour")}
                </span>
              </div>
              <div className="mt-4 flex gap-2">
                <Link
                  href={`/clubs/${clubId}/rooms/${r.id}`}
                  className="flex-1 rounded-lg bg-brand py-2 text-center text-sm font-semibold text-white hover:bg-brand-dark"
                >
                  {t("room.view")}
                </Link>
                <Link
                  href={`/clubs/${clubId}/rooms/${r.id}/edit`}
                  className="rounded-lg border border-slate-700 px-4 py-2 text-center text-sm text-slate-300 hover:bg-slate-800"
                >
                  {t("common.edit")}
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PriceInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-slate-400">{label}</span>
      <input
        type="number"
        min="0"
        value={value}
        onChange={onChange}
        placeholder="0"
        className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-brand"
      />
    </label>
  );
}
