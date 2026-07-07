"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { IconArrowLeft, IconCheck } from "@tabler/icons-react";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

type EditStation = { id: string; name: string; type: string; status: string; posX: number; posY: number };
type RoomEditData = { name: string; stations: EditStation[] };

async function fetchRoom(roomId: string): Promise<RoomEditData> {
  const res = await fetch(`/api/rooms/${roomId}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`GET room failed: ${res.status}`);
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

export default function RoomEditPage() {
  const { t } = useI18n();
  const { clubId, roomId } = useParams<{ clubId: string; roomId: string }>();
  const canvasRef = useRef<HTMLDivElement>(null);

  const { data } = useQuery({ queryKey: ["room-edit", roomId], queryFn: () => fetchRoom(roomId) });

  const [stations, setStations] = useState<EditStation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("PS5");

  // Seed local editable state from the query once it loads. Deliberately not
  // re-synced on every refetch — during a drag, `stations` is client-
  // authoritative (see the mutations below), and this query has no polling
  // and no invalidation, so this effect only ever fires once per room visit.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time seed from server data into client-authoritative drag state; see comment above.
    if (data) setStations(data.stations);
  }, [data]);

  const roomName = data?.name ?? "";

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
    const { x, y } = pointFromEvent(e);
    setStations((prev) =>
      prev.map((s) => (s.id === drag.current!.id ? { ...s, posX: x, posY: y } : s))
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
        </div>
      </header>

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
            <Button variant="destructive" className="w-full" onClick={removeSelected}>
              {t("editor.remove")}
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
}
