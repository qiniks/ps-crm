"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import { formatMoney } from "@/lib/format";
import { TARIFFS, fixedPrice, type TariffKind } from "@/lib/tariffs";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { RoomDTO, StationDTO } from "@/lib/room-types";
import type { TranslationKey } from "@/lib/i18n/dictionaries";

type Customer = { id: string; name: string };

// Radix Select rejects an empty-string item value, so "no customer" uses this sentinel
// instead of "" and is converted back to `undefined` before the API call.
const NONE = "__none__";

async function fetchCustomers(clubId: string): Promise<Customer[]> {
  const res = await fetch(`/api/clubs/${clubId}/customers`, { cache: "no-store" });
  if (!res.ok) throw new Error(`GET customers failed: ${res.status}`);
  return res.json();
}

async function bookSession(values: { stationId: string; tariffKind: TariffKind; customerId?: string }) {
  const res = await fetch("/api/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(values),
  });
  if (!res.ok) throw new Error(`POST session failed: ${res.status}`);
  return res.json();
}

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
  const queryClient = useQueryClient();
  const [tariff, setTariff] = useState<TariffKind>("HOUR_1");
  const [customerId, setCustomerId] = useState(NONE);

  // Same query key as the customers page ("customers", clubId) — TanStack
  // Query dedupes/shares this cache entry with that page automatically.
  const { data: customers = [] } = useQuery({
    queryKey: ["customers", room.club.id],
    queryFn: () => fetchCustomers(room.club.id),
  });

  const bookMutation = useMutation({
    mutationFn: bookSession,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["room", room.id] });
      onBooked();
    },
  });

  function confirm() {
    bookMutation.mutate({
      stationId: station.id,
      tariffKind: tariff,
      customerId: customerId === NONE ? undefined : customerId,
    });
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">{t("booking.station")}</div>
          <DialogTitle>
            {station.name} <span className="text-sm font-normal text-muted-foreground">· {station.type}</span>
          </DialogTitle>
        </DialogHeader>

        <div>
          <div className="mb-2 text-sm font-medium text-foreground">{t("booking.chooseTariff")}</div>
          <RadioGroup
            value={tariff}
            onValueChange={(v) => setTariff(v as TariffKind)}
            className="grid grid-cols-2 gap-3"
          >
            {TARIFFS.map(({ kind }) => {
              const price = fixedPrice(room, kind);
              return (
                <Label
                  key={kind}
                  htmlFor={`tariff-${kind}`}
                  className={cn(
                    "flex cursor-pointer flex-col gap-1 rounded-xl border p-3 font-normal transition",
                    tariff === kind ? "border-primary bg-primary/10" : "border-border hover:border-muted-foreground/40"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value={kind} id={`tariff-${kind}`} />
                    <span className="font-semibold text-foreground">{t(`tariff.${kind}` as TranslationKey)}</span>
                  </div>
                  <div className="text-sm text-success">
                    {price === null
                      ? `${formatMoney(room.openHourlyRate)} ${t("common.currency")}${t("common.perHour")}`
                      : `${formatMoney(price)} ${t("common.currency")}`}
                  </div>
                </Label>
              );
            })}
          </RadioGroup>
        </div>

        <div className="space-y-1.5">
          <Label>{t("booking.customer")}</Label>
          <Select value={customerId} onValueChange={setCustomerId}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>{t("booking.customerNone")}</SelectItem>
              {customers.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-2">
          <Button className="flex-1" disabled={bookMutation.isPending} onClick={confirm}>
            {t("booking.confirm")}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            {t("common.cancel")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
