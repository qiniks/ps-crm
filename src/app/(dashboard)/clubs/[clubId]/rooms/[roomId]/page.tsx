"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { IconCircleFilled, IconEdit } from "@tabler/icons-react";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import { useNow } from "@/lib/useNow";
import { formatDuration, formatMoney } from "@/lib/format";
import { fixedPrice, liveCost, type TariffKind } from "@/lib/tariffs";
import { canPayFromBalance, PAYMENT_METHODS, type PaymentMethod } from "@/lib/shifts";
import { StationMarker } from "@/components/room/StationMarker";
import { BookingModal } from "@/components/room/BookingModal";
import { ReservationsPanel } from "@/components/room/ReservationsPanel";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { ROOM_CANVAS_HEIGHT, type RoomDTO, type StationDTO } from "@/lib/room-types";
import type { TranslationKey } from "@/lib/i18n/dictionaries";

async function fetchRoom(roomId: string): Promise<RoomDTO> {
  const res = await fetch(`/api/rooms/${roomId}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`GET room failed: ${res.status}`);
  return res.json();
}

async function stopSession(sessionId: string, paymentMethod: PaymentMethod) {
  const res = await fetch(`/api/sessions/${sessionId}/stop`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ paymentMethod }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `POST stop failed: ${res.status}`);
  }
  return res.json();
}

async function extendSession(sessionId: string, tariffKind: TariffKind) {
  const res = await fetch(`/api/sessions/${sessionId}/extend`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tariffKind }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `POST extend failed: ${res.status}`);
  }
  return res.json();
}

export default function RoomViewPage() {
  const { t } = useI18n();
  const { clubId, roomId } = useParams<{ clubId: string; roomId: string }>();
  const queryClient = useQueryClient();
  const now = useNow(1000);
  const [booking, setBooking] = useState<StationDTO | null>(null);
  const [stopping, setStopping] = useState<StationDTO | null>(null);

  const { data: room, isLoading } = useQuery({
    queryKey: ["room", roomId],
    queryFn: () => fetchRoom(roomId),
    refetchInterval: 15000,
  });

  const stopMutation = useMutation({
    mutationFn: ({ sessionId, paymentMethod }: { sessionId: string; paymentMethod: PaymentMethod }) =>
      stopSession(sessionId, paymentMethod),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["room", roomId] });
      queryClient.invalidateQueries({ queryKey: ["shifts", clubId] });
      setStopping(null);
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ["room", roomId] });
      toast.error(t("payment.stopFailed"));
    },
  });

  const extendMutation = useMutation({
    mutationFn: ({ sessionId, tariffKind }: { sessionId: string; tariffKind: TariffKind }) =>
      extendSession(sessionId, tariffKind),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["room", roomId] });
      toast.success(t("station.extendSuccess"));
    },
    onError: () => {
      toast.error(t("station.extendFailed"));
    },
  });

  function onSelect(s: StationDTO) {
    if (s.status === "BUSY") setStopping(s);
    else setBooking(s);
  }

  if (isLoading || !room) return <div className="text-muted-foreground">{t("common.loading")}</div>;

  const busy = room.stations.filter((s) => s.status === "BUSY").length;
  const free = room.stations.filter((s) => s.status === "FREE").length;
  // `stopping` is a snapshot from the click that opened the modal; re-derive
  // it from the latest room query so an extend (which keeps the modal open)
  // shows the updated plannedEndAt/cost once the query refetches.
  const activeStopping = stopping
    ? room.stations.find((s) => s.id === stopping.id) ?? stopping
    : null;

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{room.name}</h1>
          <p className="flex items-center gap-3 text-sm text-muted-foreground">
            {room.club.name}
            <span className="flex items-center gap-1">
              <IconCircleFilled className="h-2.5 w-2.5 text-success" />
              {free} {t("room.free")}
            </span>
            <span className="flex items-center gap-1">
              <IconCircleFilled className="h-2.5 w-2.5 text-primary" />
              {busy} {t("room.busy")}
            </span>
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href={`/clubs/${clubId}/rooms/${roomId}/edit`}>
            <IconEdit className="h-4 w-4" />
            {t("room.edit")}
          </Link>
        </Button>
      </header>

      <div
        style={{ height: ROOM_CANVAS_HEIGHT[room.canvasSize] }}
        className="relative w-full overflow-hidden rounded-2xl border border-border bg-muted/40 bg-[radial-gradient(circle,hsl(var(--border))_1px,transparent_1px)] [background-size:24px_24px]"
      >
        {room.stations.length === 0 ? (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            {t("editor.emptyHint")}
          </div>
        ) : (
          room.stations.map((s) => (
            <StationMarker key={s.id} station={s} room={room} now={now} onSelect={onSelect} />
          ))
        )}
      </div>

      <ReservationsPanel room={room} now={now} />

      {booking && (
        <BookingModal
          room={room}
          station={booking}
          onClose={() => setBooking(null)}
          onBooked={() => {
            setBooking(null);
            queryClient.invalidateQueries({ queryKey: ["room", roomId] });
          }}
        />
      )}

      {activeStopping?.activeSession && (
        <StopModal
          station={activeStopping}
          room={room}
          now={now}
          pending={stopMutation.isPending}
          extendPending={extendMutation.isPending}
          onClose={() => setStopping(null)}
          onStop={(paymentMethod) =>
            stopMutation.mutate({ sessionId: activeStopping.activeSession!.id, paymentMethod })
          }
          onExtend={(tariffKind) =>
            extendMutation.mutate({ sessionId: activeStopping.activeSession!.id, tariffKind })
          }
        />
      )}
    </div>
  );
}

const EXTEND_TARIFFS: TariffKind[] = ["HOUR_1", "HOUR_3", "HOUR_5"];

function StopModal({
  station,
  room,
  now,
  pending,
  extendPending,
  onClose,
  onStop,
  onExtend,
}: {
  station: StationDTO;
  room: RoomDTO;
  now: number;
  pending: boolean;
  extendPending: boolean;
  onClose: () => void;
  onStop: (paymentMethod: PaymentMethod) => void;
  onExtend: (tariffKind: TariffKind) => void;
}) {
  const { t } = useI18n();
  const [method, setMethod] = useState<PaymentMethod>("CASH");
  const sess = station.activeSession!;
  const started = new Date(sess.startedAt).getTime();
  // For a fixed tariff, `sess.cost` is the source of truth — it can exceed
  // the tariff's base price after an extend (see POST
  // /api/sessions/[id]/extend), which a freshly-derived fixedPrice() would
  // miss. OPEN sessions have no stored running cost, so they still derive it
  // live from elapsed time.
  const cost = sess.tariffKind === "OPEN" ? liveCost(sess, room, now) : sess.cost;
  const balanceEligible = canPayFromBalance(
    sess.customerId ? { balance: sess.customerBalance ?? 0 } : null,
    cost
  );
  // If the elapsed cost of an OPEN-tariff session grows past the customer's
  // balance while the modal is open, fall back off the now-ineligible
  // selection — derived, not synced via effect, so it can't lag a render.
  const effectiveMethod: PaymentMethod = method === "BALANCE" && !balanceEligible ? "CASH" : method;

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{station.name}</DialogTitle>
        </DialogHeader>
        <div className="text-sm text-muted-foreground">
          {t(`tariff.${sess.tariffKind}` as TranslationKey)}
          {sess.customerName ? ` · ${sess.customerName}` : ""}
        </div>
        <div className="flex justify-between rounded-lg bg-muted p-3 text-sm">
          <span className="text-muted-foreground">{t("station.elapsed")}</span>
          <span className="font-mono text-foreground">{formatDuration(now - started)}</span>
        </div>
        <div className="flex justify-between rounded-lg bg-muted p-3">
          <span className="text-muted-foreground">{t("station.cost")}</span>
          <span className="text-lg font-bold text-success">
            {formatMoney(cost)} {t("common.currency")}
          </span>
        </div>
        {sess.tariffKind !== "OPEN" && (
          <div>
            <div className="mb-1.5 text-sm font-medium text-foreground">{t("station.extend")}</div>
            <div className="grid grid-cols-3 gap-2">
              {EXTEND_TARIFFS.map((kind) => (
                <Button
                  key={kind}
                  type="button"
                  variant="outline"
                  disabled={extendPending}
                  onClick={() => onExtend(kind)}
                >
                  <span className="flex flex-col items-center leading-tight">
                    <span>{t(`tariff.${kind}` as TranslationKey)}</span>
                    <span className="text-xs text-muted-foreground">
                      +{formatMoney(fixedPrice(room, kind) ?? 0)} {t("common.currency")}
                    </span>
                  </span>
                </Button>
              ))}
            </div>
          </div>
        )}

        <div>
          <div className="mb-1.5 text-sm font-medium text-foreground">{t("payment.method")}</div>
          <div className="grid grid-cols-3 gap-2">
            {PAYMENT_METHODS.map((m) => {
              const disabled = m === "BALANCE" && !balanceEligible;
              return (
                <Button
                  key={m}
                  type="button"
                  variant={effectiveMethod === m ? "default" : "outline"}
                  disabled={disabled}
                  className={cn(effectiveMethod !== m && "text-muted-foreground")}
                  onClick={() => setMethod(m)}
                >
                  {t(`payment.${m}` as TranslationKey)}
                </Button>
              );
            })}
          </div>
          {!balanceEligible && (
            <p className="mt-1.5 text-xs text-muted-foreground">
              {sess.customerId ? t("payment.balanceInsufficient") : t("payment.balanceNoCustomer")}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="destructive" className="flex-1" disabled={pending} onClick={() => onStop(effectiveMethod)}>
            {t("station.stop")}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            {t("common.cancel")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
