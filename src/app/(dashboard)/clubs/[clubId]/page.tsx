"use client";

import { useState } from "react";
import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { IconDeviceGamepad2 } from "@tabler/icons-react";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import { formatMoney } from "@/lib/format";
import { PageHeader } from "@/components/ui-patterns/page-header";
import { EmptyState } from "@/components/ui-patterns/empty-state";
import { ErrorState } from "@/components/ui-patterns/error-state";
import { ShiftCard } from "@/components/shift/ShiftCard";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Room = {
  id: string;
  name: string;
  price1h: number;
  price3h: number;
  price5h: number;
  openHourlyRate: number;
  stationCount: number;
};

type RoomsResponse = { club: { name: string }; rooms: Room[] };

class RoomsFetchError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = "RoomsFetchError";
  }
}

const EMPTY = { name: "", price1h: "", price3h: "", price5h: "", openHourlyRate: "" };

async function fetchRooms(clubId: string): Promise<RoomsResponse> {
  const res = await fetch(`/api/clubs/${clubId}/rooms`, { cache: "no-store" });
  if (!res.ok) {
    throw new RoomsFetchError(`GET rooms failed: ${res.status}`, res.status);
  }
  return res.json();
}

async function createRoom(clubId: string, values: typeof EMPTY) {
  const res = await fetch(`/api/clubs/${clubId}/rooms`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(values),
  });
  if (!res.ok) throw new Error(`POST room failed: ${res.status}`);
  return res.json();
}

export default function ClubPage() {
  const { t } = useI18n();
  const { clubId } = useParams<{ clubId: string }>();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(EMPTY);
  const [open, setOpen] = useState(false);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["rooms", clubId],
    queryFn: () => fetchRooms(clubId),
  });

  const createRoomMutation = useMutation({
    mutationFn: (values: typeof EMPTY) => createRoom(clubId, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rooms", clubId] });
      setForm(EMPTY);
      setOpen(false);
      toast.success(t("club.roomCreated"));
    },
  });

  function create(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    createRoomMutation.mutate(form);
  }

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  if (isError && error instanceof RoomsFetchError && error.status === 404) {
    notFound();
  }

  const clubName = data?.club.name ?? "";
  const rooms = data?.rooms ?? [];

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title={clubName}
        subtitle={t("club.rooms")}
        actions={<Button onClick={() => setOpen(true)}>+ {t("club.addRoom")}</Button>}
      />

      <ShiftCard clubId={clubId} />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("club.addRoom")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={create} className="flex flex-col gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="room-name">{t("club.roomName")}</Label>
              <Input id="room-name" value={form.name} onChange={set("name")} />
            </div>
            <div>
              <div className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">
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
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button disabled={createRoomMutation.isPending}>{t("common.create")}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {isLoading ? (
        <div className="text-muted-foreground">{t("common.loading")}</div>
      ) : isError ? (
        <ErrorState message={t("common.error")} onRetry={() => refetch()} retryLabel={t("common.retry")} />
      ) : rooms.length === 0 ? (
        <EmptyState icon={<IconDeviceGamepad2 className="h-8 w-8" />} message={t("club.noRooms")} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {rooms.map((r) => (
            <Card key={r.id} className="p-5">
              <div className="flex items-center justify-between">
                <div className="font-semibold text-foreground">{r.name}</div>
                <Badge variant="secondary">
                  {r.stationCount} {t("club.stationsCount")}
                </Badge>
              </div>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>1h: {formatMoney(r.price1h)}</span>
                <span>3h: {formatMoney(r.price3h)}</span>
                <span>5h: {formatMoney(r.price5h)}</span>
                <span>
                  {t("station.openTariff")}: {formatMoney(r.openHourlyRate)}
                  {t("common.perHour")}
                </span>
              </div>
              <div className="mt-4 flex gap-2">
                <Button asChild className="flex-1">
                  <Link href={`/clubs/${clubId}/rooms/${r.id}`}>{t("room.view")}</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href={`/clubs/${clubId}/rooms/${r.id}/edit`}>{t("common.edit")}</Link>
                </Button>
              </div>
            </Card>
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
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input type="number" min="0" value={value} onChange={onChange} placeholder="0" />
    </div>
  );
}
