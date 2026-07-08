"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { IconCircleFilled, IconEdit } from "@tabler/icons-react";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import { useNow } from "@/lib/useNow";
import { formatDuration, formatMoney } from "@/lib/format";
import { StationMarker } from "@/components/room/StationMarker";
import { BookingModal } from "@/components/room/BookingModal";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { RoomDTO, StationDTO } from "@/lib/room-types";
import type { TranslationKey } from "@/lib/i18n/dictionaries";

async function fetchRoom(roomId: string): Promise<RoomDTO> {
  const res = await fetch(`/api/rooms/${roomId}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`GET room failed: ${res.status}`);
  return res.json();
}

async function stopSession(sessionId: string) {
  const res = await fetch(`/api/sessions/${sessionId}/stop`, { method: "POST" });
  if (!res.ok) throw new Error(`POST stop failed: ${res.status}`);
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
    mutationFn: stopSession,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["room", roomId] });
      setStopping(null);
    },
  });

  function onSelect(s: StationDTO) {
    if (s.status === "BUSY") setStopping(s);
    else setBooking(s);
  }

  if (isLoading || !room) return <div className="text-muted-foreground">{t("common.loading")}</div>;

  const busy = room.stations.filter((s) => s.status === "BUSY").length;
  const free = room.stations.filter((s) => s.status === "FREE").length;

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

      <div className="relative aspect-[16/9] w-full overflow-hidden rounded-2xl border border-border bg-muted/40 bg-[radial-gradient(circle,hsl(var(--border))_1px,transparent_1px)] [background-size:24px_24px]">
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

      {stopping?.activeSession && (
        <StopModal
          station={stopping}
          room={room}
          now={now}
          onClose={() => setStopping(null)}
          onStop={() => stopMutation.mutate(stopping.activeSession!.id)}
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
        <div className="flex gap-2">
          <Button variant="destructive" className="flex-1" onClick={onStop}>
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
