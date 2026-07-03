"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import { useNow } from "@/lib/useNow";
import { formatDuration, formatMoney } from "@/lib/format";
import { StationMarker } from "@/components/room/StationMarker";
import { BookingModal } from "@/components/room/BookingModal";
import type { RoomDTO, StationDTO } from "@/lib/room-types";
import type { TranslationKey } from "@/lib/i18n/dictionaries";

export default function RoomViewPage() {
  const { t } = useI18n();
  const { clubId, roomId } = useParams<{ clubId: string; roomId: string }>();
  const now = useNow(1000);
  const [room, setRoom] = useState<RoomDTO | null>(null);
  const [booking, setBooking] = useState<StationDTO | null>(null);
  const [stopping, setStopping] = useState<StationDTO | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/rooms/${roomId}`, { cache: "no-store" });
    if (res.ok) setRoom(await res.json());
  }, [roomId]);

  useEffect(() => {
    // TODO(2026-07-02-tanstack-query-migration.md): this fetch pattern is replaced by useQuery in that plan; suppressing the new rule here rather than hand-restructuring ahead of it.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, [load]);

  function onSelect(s: StationDTO) {
    if (s.status === "BUSY") setStopping(s);
    else setBooking(s);
  }

  async function stopSession() {
    if (!stopping?.activeSession) return;
    await fetch(`/api/sessions/${stopping.activeSession.id}/stop`, { method: "POST" });
    setStopping(null);
    load();
  }

  if (!room) return <div className="text-slate-400">{t("common.loading")}</div>;

  const busy = room.stations.filter((s) => s.status === "BUSY").length;
  const free = room.stations.filter((s) => s.status === "FREE").length;

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{room.name}</h1>
          <p className="text-sm text-slate-400">
            {room.club.name} · 🟢 {free} {t("room.free")} · 🔵 {busy} {t("room.busy")}
          </p>
        </div>
        <Link
          href={`/clubs/${clubId}/rooms/${roomId}/edit`}
          className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
        >
          ✏️ {t("room.edit")}
        </Link>
      </header>

      <div className="relative aspect-[16/9] w-full overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60 bg-[radial-gradient(circle,#1e293b_1px,transparent_1px)] [background-size:24px_24px]">
        {room.stations.length === 0 ? (
          <div className="flex h-full items-center justify-center text-slate-500">
            {t("editor.emptyHint")}
          </div>
        ) : (
          room.stations.map((s) => (
            <StationMarker key={s.id} station={s} room={room} now={now} onSelect={onSelect} />
          ))
        )}
      </div>

      {booking && (
        <BookingModal
          room={room}
          station={booking}
          onClose={() => setBooking(null)}
          onBooked={() => {
            setBooking(null);
            load();
          }}
        />
      )}

      {stopping?.activeSession && (
        <StopModal
          station={stopping}
          room={room}
          now={now}
          onClose={() => setStopping(null)}
          onStop={stopSession}
        />
      )}
    </div>
  );
}

function StopModal({
  station,
  room,
  now,
  onClose,
  onStop,
}: {
  station: StationDTO;
  room: RoomDTO;
  now: number;
  onClose: () => void;
  onStop: () => void;
}) {
  const { t } = useI18n();
  const sess = station.activeSession!;
  const started = new Date(sess.startedAt).getTime();
  const cost =
    sess.tariffKind === "OPEN"
      ? Math.round(((now - started) / 3_600_000) * room.openHourlyRate)
      : sess.tariffKind === "HOUR_1"
      ? room.price1h
      : sess.tariffKind === "HOUR_3"
      ? room.price3h
      : room.price5h;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-1 text-xl font-bold text-white">{station.name}</h2>
        <div className="mb-4 text-sm text-slate-400">
          {t(`tariff.${sess.tariffKind}` as TranslationKey)}
          {sess.customerName ? ` · 👤 ${sess.customerName}` : ""}
        </div>
        <div className="mb-5 flex justify-between rounded-lg bg-slate-950 p-3 text-sm">
          <span className="text-slate-400">{t("station.elapsed")}</span>
          <span className="font-mono text-white">{formatDuration(now - started)}</span>
        </div>
        <div className="mb-5 flex justify-between rounded-lg bg-slate-950 p-3">
          <span className="text-slate-400">{t("station.cost")}</span>
          <span className="text-lg font-bold text-emerald-300">
            {formatMoney(cost)} {t("common.currency")}
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onStop}
            className="flex-1 rounded-lg bg-rose-600 py-2.5 text-sm font-semibold text-white hover:bg-rose-500"
          >
            {t("station.stop")}
          </button>
          <button onClick={onClose} className="rounded-lg px-4 py-2.5 text-sm text-slate-400 hover:text-white">
            {t("common.cancel")}
          </button>
        </div>
      </div>
    </div>
  );
}
