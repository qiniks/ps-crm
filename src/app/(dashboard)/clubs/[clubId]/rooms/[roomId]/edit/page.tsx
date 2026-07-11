"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { IconArrowLeft, IconCheck, IconTrash } from "@tabler/icons-react";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import { formatMoney } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type EditStation = { id: string; name: string; type: string; status: string; posX: number; posY: number };
type RoomEditData = {
  name: string;
  price1h: number;
  price3h: number;
  price5h: number;
  openHourlyRate: number;
  stations: EditStation[];
};
type RoomPricePatch = Partial<{ name: string; price1h: number; price3h: number; price5h: number; openHourlyRate: number }>;

async function fetchRoom(roomId: string): Promise<RoomEditData> {
  const res = await fetch(`/api/rooms/${roomId}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`GET room failed: ${res.status}`);
  return res.json();
}

async function patchRoomRequest(roomId: string, patch: RoomPricePatch) {
  const res = await fetch(`/api/rooms/${roomId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`PATCH room failed: ${res.status}`);
  return res.json();
}

async function addStationRequest(
  roomId: string,
  values: { name: string; type: string; posX: number; posY: number }
) {
  const res = await fetch(`/api/rooms/${roomId}/stations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(values),
  });
  if (!res.ok) throw new Error(`POST station failed: ${res.status}`);
  return res.json();
}

async function patchStationRequest(stationId: string, patch: Partial<EditStation>) {
  const res = await fetch(`/api/stations/${stationId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`PATCH station failed: ${res.status}`);
  return res.json();
}

async function deleteStationRequest(stationId: string) {
  const res = await fetch(`/api/stations/${stationId}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`DELETE station failed: ${res.status}`);
}

async function saveLayoutRequest(roomId: string, positions: { id: string; posX: number; posY: number }[]) {
  const res = await fetch(`/api/rooms/${roomId}/layout`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ positions }),
  });
  if (!res.ok) throw new Error(`PUT layout failed: ${res.status}`);
  return res.json();
}

async function deleteRoomRequest(roomId: string) {
  const res = await fetch(`/api/rooms/${roomId}`, { method: "DELETE" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(typeof body.error === "string" ? body.error : `DELETE room failed: ${res.status}`);
  }
  return res.json();
}

export default function RoomEditPage() {
  const { t } = useI18n();
  const { clubId, roomId } = useParams<{ clubId: string; roomId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const canvasRef = useRef<HTMLDivElement>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const { data } = useQuery({ queryKey: ["room-edit", roomId], queryFn: () => fetchRoom(roomId) });

  const [stations, setStations] = useState<EditStation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("PS5");
  const [editingPrices, setEditingPrices] = useState(false);
  const [roomForm, setRoomForm] = useState({
    name: "",
    price1h: "",
    price3h: "",
    price5h: "",
    openHourlyRate: "",
  });

  // Seed local editable state from the query once it loads. Deliberately not
  // re-synced on every refetch — during a drag, `stations` is client-
  // authoritative (see the mutations below), and this query has no polling
  // and no invalidation, so this effect only ever fires once per room visit.
  useEffect(() => {
    if (data) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time seed from server data into client-authoritative drag state; see comment above.
      setStations(data.stations);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time seed, same as above.
      setRoomForm({
        name: data.name,
        price1h: String(data.price1h),
        price3h: String(data.price3h),
        price5h: String(data.price5h),
        openHourlyRate: String(data.openHourlyRate),
      });
    }
  }, [data]);

  const roomName = data?.name ?? "";

  const patchRoomMutation = useMutation({
    mutationFn: (patch: RoomPricePatch) => patchRoomRequest(roomId, patch),
  });

  // Debounce room-field edits so we don't fire a PATCH per keystroke — pending
  // fields are merged and flushed together after a pause in typing.
  const pendingRoomPatch = useRef<RoomPricePatch>({});
  const roomPatchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (roomPatchTimer.current) clearTimeout(roomPatchTimer.current);
    };
  }, []);

  function updateRoomField(key: keyof typeof roomForm, value: string) {
    setRoomForm((f) => ({ ...f, [key]: value }));
    (pendingRoomPatch.current as Record<string, unknown>)[key] =
      key === "name" ? value : Math.max(0, Math.round(Number(value) || 0));

    if (roomPatchTimer.current) clearTimeout(roomPatchTimer.current);
    roomPatchTimer.current = setTimeout(() => {
      const patch = pendingRoomPatch.current;
      pendingRoomPatch.current = {};
      patchRoomMutation.mutate(patch);
    }, 500);
  }

  // Send any not-yet-debounced edit immediately, e.g. when the user hits Save.
  function flushRoomPatch() {
    if (roomPatchTimer.current) {
      clearTimeout(roomPatchTimer.current);
      roomPatchTimer.current = null;
    }
    if (Object.keys(pendingRoomPatch.current).length > 0) {
      const patch = pendingRoomPatch.current;
      pendingRoomPatch.current = {};
      patchRoomMutation.mutate(patch);
    }
  }

  function closePriceEditor() {
    flushRoomPatch();
    setEditingPrices(false);
  }

  // Drag bookkeeping (refs so we don't re-render per mousemove).
  const drag = useRef<{ id: string; moved: boolean } | null>(null);

  function pointFromEvent(e: React.PointerEvent) {
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    return { x: Math.min(100, Math.max(0, x)), y: Math.min(100, Math.max(0, y)) };
  }

  function onPointerDown(e: React.PointerEvent, id: string) {
    (e.target as Element).setPointerCapture(e.pointerId);
    drag.current = { id, moved: false };
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current) return;
    drag.current.moved = true;
    const id = drag.current.id;
    const { x, y } = pointFromEvent(e);
    setStations((prev) =>
      prev.map((s) => (s.id === id ? { ...s, posX: x, posY: y } : s))
    );
    setDirty(true);
    setSaveState("idle");
  }

  function onPointerUp(e: React.PointerEvent, id: string) {
    (e.target as Element).releasePointerCapture?.(e.pointerId);
    // A press without movement counts as a selection.
    if (drag.current && !drag.current.moved) setSelectedId(id);
    drag.current = null;
  }

  const addStationMutation = useMutation({
    mutationFn: (values: { name: string; type: string; posX: number; posY: number }) =>
      addStationRequest(roomId, values),
    onSuccess: (created: EditStation) => {
      setStations((prev) => [...prev, created]);
      setNewName("");
      setSelectedId(created.id);
    },
  });

  function addStation(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    addStationMutation.mutate({ name: newName, type: newType, posX: 50, posY: 50 });
  }

  const patchStationMutation = useMutation({
    mutationFn: ({ stationId, patch }: { stationId: string; patch: Partial<EditStation> }) =>
      patchStationRequest(stationId, patch),
  });

  function patchSelected(patch: Partial<EditStation>) {
    if (!selectedId) return;
    setStations((prev) => prev.map((s) => (s.id === selectedId ? { ...s, ...patch } : s)));
    patchStationMutation.mutate({ stationId: selectedId, patch });
  }

  const removeStationMutation = useMutation({
    mutationFn: deleteStationRequest,
    onSuccess: (_data, stationId) => {
      setStations((prev) => prev.filter((s) => s.id !== stationId));
      setSelectedId(null);
    },
  });

  function removeSelected() {
    if (!selectedId) return;
    removeStationMutation.mutate(selectedId);
  }

  const saveLayoutMutation = useMutation({
    mutationFn: () =>
      saveLayoutRequest(
        roomId,
        stations.map((s) => ({ id: s.id, posX: s.posX, posY: s.posY }))
      ),
    onSuccess: () => {
      setDirty(false);
      setSaveState("saved");
      toast.success(t("editor.saved"));
    },
  });

  function saveLayout() {
    setSaveState("saving");
    saveLayoutMutation.mutate();
  }

  const deleteRoomMutation = useMutation({
    mutationFn: () => deleteRoomRequest(roomId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rooms", clubId] });
      toast.success(t("room.archived"));
      router.push(`/clubs/${clubId}`);
    },
    onError: (error: Error) => {
      setConfirmingDelete(false);
      toast.error(
        error.message === "room-has-active-session" ? t("room.deleteBlockedSession") : t("common.error")
      );
    },
  });

  const selected = stations.find((s) => s.id === selectedId) ?? null;

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href={`/clubs/${clubId}`}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <IconArrowLeft className="h-3 w-3" />
            {roomName}
          </Link>
          <h1 className="text-2xl font-bold text-foreground">{t("editor.title")}</h1>
        </div>
        <div className="flex items-center gap-3">
          <Button asChild variant="outline">
            <Link href={`/clubs/${clubId}/rooms/${roomId}`}>{t("room.view")}</Link>
          </Button>
          <Button onClick={saveLayout} disabled={saveState === "saving"} variant={dirty ? "default" : "secondary"}>
            {saveState === "saving" ? (
              t("editor.saving")
            ) : saveState === "saved" && !dirty ? (
              <>
                <IconCheck className="h-4 w-4" />
                {t("editor.saved")}
              </>
            ) : (
              t("editor.save")
            )}
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            aria-label={t("room.delete")}
            onClick={() => setConfirmingDelete(true)}
          >
            <IconTrash className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <Card className="mb-4 p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            {t("room.pricing")} ({t("common.currency")})
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => (editingPrices ? closePriceEditor() : setEditingPrices(true))}
          >
            {editingPrices ? t("common.save") : t("editor.editPrices")}
          </Button>
        </div>

        {editingPrices ? (
          <>
            <div className="mb-3 space-y-1.5">
              <Label className="text-xs text-muted-foreground">{t("club.roomName")}</Label>
              <Input
                value={roomForm.name}
                onChange={(e) => updateRoomField("name", e.target.value)}
                className="max-w-xs"
              />
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <PriceInput
                label={t("room.price1h")}
                value={roomForm.price1h}
                onChange={(v) => updateRoomField("price1h", v)}
              />
              <PriceInput
                label={t("room.price3h")}
                value={roomForm.price3h}
                onChange={(v) => updateRoomField("price3h", v)}
              />
              <PriceInput
                label={t("room.price5h")}
                value={roomForm.price5h}
                onChange={(v) => updateRoomField("price5h", v)}
              />
              <PriceInput
                label={t("room.priceOpen")}
                value={roomForm.openHourlyRate}
                onChange={(v) => updateRoomField("openHourlyRate", v)}
              />
            </div>
          </>
        ) : (
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>{t("room.price1h")}: {formatMoney(Number(roomForm.price1h) || 0)}</span>
            <span>{t("room.price3h")}: {formatMoney(Number(roomForm.price3h) || 0)}</span>
            <span>{t("room.price5h")}: {formatMoney(Number(roomForm.price5h) || 0)}</span>
            <span>{t("room.priceOpen")}: {formatMoney(Number(roomForm.openHourlyRate) || 0)}</span>
          </div>
        )}
      </Card>

      <form onSubmit={addStation} className="mb-4 flex flex-wrap gap-2">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder={t("editor.stationName")}
          className="max-w-xs"
        />
        <Select value={newType} onValueChange={setNewType}>
          <SelectTrigger className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="PS5">PS5</SelectItem>
            <SelectItem value="PS4">PS4</SelectItem>
          </SelectContent>
        </Select>
        <Button>+ {t("editor.addStation")}</Button>
      </form>

      <p className="mb-2 text-xs text-muted-foreground">{t("editor.hint")}</p>

      <div className="flex gap-4">
        <div
          ref={canvasRef}
          onPointerMove={onPointerMove}
          className="relative aspect-[16/9] flex-1 touch-none overflow-hidden rounded-2xl border border-border bg-muted/40 bg-[radial-gradient(circle,hsl(var(--border))_1px,transparent_1px)] [background-size:24px_24px]"
        >
          {stations.length === 0 && (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              {t("editor.emptyHint")}
            </div>
          )}
          {stations.map((s) => (
            <div
              key={s.id}
              onPointerDown={(e) => onPointerDown(e, s.id)}
              onPointerUp={(e) => onPointerUp(e, s.id)}
              style={{ left: `${s.posX}%`, top: `${s.posY}%` }}
              className={cn(
                "absolute w-24 -translate-x-1/2 -translate-y-1/2 cursor-grab touch-none select-none rounded-xl border-2 bg-card p-2 text-center shadow-lg active:cursor-grabbing",
                selectedId === s.id ? "border-primary" : "border-border"
              )}
            >
              <div className="truncate text-xs font-semibold text-foreground">{s.name}</div>
              <div className="text-[10px] text-muted-foreground">{s.type}</div>
            </div>
          ))}
        </div>

        {selected && (
          <Card className="w-56 shrink-0 p-4">
            <div className="mb-3 text-sm font-semibold text-foreground">{selected.name}</div>
            <div className="mb-3 space-y-1.5">
              <Label className="text-xs text-muted-foreground">{t("editor.stationName")}</Label>
              <Input value={selected.name} onChange={(e) => patchSelected({ name: e.target.value })} />
            </div>
            <div className="mb-4 space-y-1.5">
              <Label className="text-xs text-muted-foreground">{t("editor.type")}</Label>
              <Select value={selected.type} onValueChange={(v) => patchSelected({ type: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PS5">PS5</SelectItem>
                  <SelectItem value="PS4">PS4</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="mb-4 space-y-1.5">
              <Label className="text-xs text-muted-foreground">{t("editor.status")}</Label>
              <div>
                <span
                  className={cn(
                    "inline-block rounded-full px-2 py-0.5 text-[11px] font-medium",
                    selected.status === "MAINTENANCE"
                      ? "bg-warning/15 text-warning"
                      : selected.status === "BUSY"
                      ? "bg-success/15 text-success"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {selected.status === "MAINTENANCE"
                    ? t("station.maintenance")
                    : selected.status === "BUSY"
                    ? t("station.busy")
                    : t("station.free")}
                </span>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                onClick={() =>
                  patchSelected({
                    status: selected.status === "MAINTENANCE" ? "FREE" : "MAINTENANCE",
                  })
                }
              >
                {selected.status === "MAINTENANCE" ? t("editor.markAvailable") : t("editor.markMaintenance")}
              </Button>
            </div>
            <Button variant="destructive" className="w-full" onClick={removeSelected}>
              {t("editor.remove")}
            </Button>
          </Card>
        )}
      </div>

      <Dialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("room.deleteConfirmTitle")}</DialogTitle>
            <DialogDescription>{t("room.deleteConfirmBody")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmingDelete(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="destructive"
              disabled={deleteRoomMutation.isPending}
              onClick={() => deleteRoomMutation.mutate()}
            >
              {t("common.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input type="number" min="0" value={value} onChange={(e) => onChange(e.target.value)} placeholder="0" />
    </div>
  );
}
