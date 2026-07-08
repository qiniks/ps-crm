"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { IconCalendarPlus, IconPlayerPlay, IconX } from "@tabler/icons-react";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import { RESERVABLE_TARIFFS } from "@/lib/reservations";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { RoomDTO } from "@/lib/room-types";
import type { TariffKind } from "@/lib/tariffs";
import type { TranslationKey } from "@/lib/i18n/dictionaries";

type ReservationDTO = {
  id: string;
  stationId: string;
  stationName: string;
  tariffKind: TariffKind;
  startAt: string;
  endAt: string;
  name: string | null;
};

async function fetchReservations(roomId: string): Promise<ReservationDTO[]> {
  const res = await fetch(`/api/rooms/${roomId}/reservations`, { cache: "no-store" });
  if (!res.ok) throw new Error(`GET reservations failed: ${res.status}`);
  return res.json();
}

async function createReservation(
  roomId: string,
  values: { stationId: string; tariffKind: TariffKind; startAt: string; guestName?: string }
) {
  const res = await fetch(`/api/rooms/${roomId}/reservations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(values),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `POST reservation failed: ${res.status}`);
  }
  return res.json();
}

async function patchReservation(id: string, action: "cancel" | "seat") {
  const res = await fetch(`/api/reservations/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `PATCH reservation failed: ${res.status}`);
  }
  return res.json();
}

// Rounds "now + 1h" to the next quarter hour and formats it for datetime-local.
function defaultStartValue(): string {
  const d = new Date(Date.now() + 3_600_000);
  d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ReservationsPanel({ room }: { room: RoomDTO }) {
  const { t, locale } = useI18n();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stationId, setStationId] = useState("");
  const [tariff, setTariff] = useState<TariffKind>("HOUR_1");
  const [startAt, setStartAt] = useState(defaultStartValue);
  const [guestName, setGuestName] = useState("");

  const { data: reservations = [] } = useQuery({
    queryKey: ["reservations", room.id],
    queryFn: () => fetchReservations(room.id),
    refetchInterval: 30000,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["reservations", room.id] });
    queryClient.invalidateQueries({ queryKey: ["room", room.id] });
  };

  const createMutation = useMutation({
    mutationFn: (values: { stationId: string; tariffKind: TariffKind; startAt: string; guestName?: string }) =>
      createReservation(room.id, values),
    onSuccess: () => {
      invalidate();
      setOpen(false);
      setGuestName("");
      setError(null);
    },
    onError: (e: Error) => {
      setError(e.message === "reservation-conflict" ? t("reservation.conflict") : t("common.error"));
    },
  });

  const patchMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "cancel" | "seat" }) =>
      patchReservation(id, action),
    onSuccess: invalidate,
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!stationId || !startAt) return;
    setError(null);
    createMutation.mutate({
      stationId,
      tariffKind: tariff,
      startAt: new Date(startAt).toISOString(),
      guestName: guestName || undefined,
    });
  }

  const timeFmt: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" };

  return (
    <div className="mt-6">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">{t("reservation.list")}</h2>
        <Button variant="outline" onClick={() => { setError(null); setStartAt(defaultStartValue()); setOpen(true); }}>
          <IconCalendarPlus className="h-4 w-4" />
          {t("reservation.new")}
        </Button>
      </div>

      {reservations.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("reservation.empty")}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {reservations.map((r) => {
            const start = new Date(r.startAt);
            const sameDay = start.toDateString() === new Date().toDateString();
            return (
              <div
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <Badge variant="secondary" className="font-mono">
                    {sameDay
                      ? start.toLocaleTimeString(locale, timeFmt)
                      : start.toLocaleString(locale, { ...timeFmt, day: "numeric", month: "short" })}
                    –{new Date(r.endAt).toLocaleTimeString(locale, timeFmt)}
                  </Badge>
                  <div>
                    <div className="text-sm font-medium text-foreground">
                      {r.stationName}
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        {t(`tariff.${r.tariffKind}` as TranslationKey)}
                      </span>
                    </div>
                    {r.name && <div className="text-xs text-muted-foreground">{r.name}</div>}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    disabled={patchMutation.isPending}
                    onClick={() => patchMutation.mutate({ id: r.id, action: "seat" })}
                  >
                    <IconPlayerPlay className="h-3.5 w-3.5" />
                    {t("reservation.seat")}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-muted-foreground"
                    disabled={patchMutation.isPending}
                    onClick={() => patchMutation.mutate({ id: r.id, action: "cancel" })}
                  >
                    <IconX className="h-3.5 w-3.5" />
                    {t("common.cancel")}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={(v) => !v && setOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("reservation.new")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="flex flex-col gap-4">
            <div className="space-y-1.5">
              <Label>{t("booking.station")}</Label>
              <Select value={stationId} onValueChange={setStationId} required>
                <SelectTrigger>
                  <SelectValue placeholder={t("reservation.pickStation")} />
                </SelectTrigger>
                <SelectContent>
                  {room.stations.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} · {s.type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t("reports.tariff")}</Label>
                <Select value={tariff} onValueChange={(v) => setTariff(v as TariffKind)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RESERVABLE_TARIFFS.map((k) => (
                      <SelectItem key={k} value={k}>
                        {t(`tariff.${k}` as TranslationKey)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="res-start">{t("reservation.time")}</Label>
                <Input
                  id="res-start"
                  type="datetime-local"
                  value={startAt}
                  onChange={(e) => setStartAt(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="res-guest">{t("reservation.guestName")}</Label>
              <Input
                id="res-guest"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder={t("reservation.guestName")}
              />
            </div>
            {error && <div className="text-sm text-destructive">{error}</div>}
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button disabled={createMutation.isPending || !stationId}>
                {t("reservation.create")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
