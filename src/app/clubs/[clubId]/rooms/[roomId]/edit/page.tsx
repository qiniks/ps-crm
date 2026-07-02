"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useI18n } from "@/lib/i18n/LanguageProvider";

type EditStation = {
  id: string;
  name: string;
  type: string;
  status: string;
  posX: number;
  posY: number;
};

export default function RoomEditPage() {
  const { t } = useI18n();
  const { clubId, roomId } = useParams<{ clubId: string; roomId: string }>();
  const canvasRef = useRef<HTMLDivElement>(null);

  const [roomName, setRoomName] = useState("");
  const [stations, setStations] = useState<EditStation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("PS5");

  // Drag bookkeeping (refs so we don't re-render per mousemove).
  const drag = useRef<{ id: string; moved: boolean } | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/rooms/${roomId}`, { cache: "no-store" });
    const data = await res.json();
    setRoomName(data.name);
    setStations(
      data.stations.map((s: EditStation) => ({
        id: s.id,
        name: s.name,
        type: s.type,
        status: s.status,
        posX: s.posX,
        posY: s.posY,
      }))
    );
  }, [roomId]);

  useEffect(() => {
    load();
  }, [load]);

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

  async function addStation(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    const res = await fetch(`/api/rooms/${roomId}/stations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName, type: newType, posX: 50, posY: 50 }),
    });
    const created = await res.json();
    setStations((prev) => [...prev, created]);
    setNewName("");
    setSelectedId(created.id);
  }

  async function patchSelected(patch: Partial<EditStation>) {
    if (!selectedId) return;
    setStations((prev) => prev.map((s) => (s.id === selectedId ? { ...s, ...patch } : s)));
    await fetch(`/api/stations/${selectedId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
  }

  async function removeSelected() {
    if (!selectedId) return;
    await fetch(`/api/stations/${selectedId}`, { method: "DELETE" });
    setStations((prev) => prev.filter((s) => s.id !== selectedId));
    setSelectedId(null);
  }

  async function saveLayout() {
    setSaveState("saving");
    await fetch(`/api/rooms/${roomId}/layout`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        positions: stations.map((s) => ({ id: s.id, posX: s.posX, posY: s.posY })),
      }),
    });
    setDirty(false);
    setSaveState("saved");
  }

  const selected = stations.find((s) => s.id === selectedId) ?? null;

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href={`/clubs/${clubId}`} className="text-xs text-slate-400 hover:text-white">
            ← {roomName}
          </Link>
          <h1 className="text-2xl font-bold text-white">{t("editor.title")}</h1>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={`/clubs/${clubId}/rooms/${roomId}`}
            className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
          >
            {t("room.view")}
          </Link>
          <button
            onClick={saveLayout}
            disabled={saveState === "saving"}
            className={`rounded-lg px-4 py-2 text-sm font-semibold text-white ${
              dirty ? "bg-brand hover:bg-brand-dark" : "bg-slate-700"
            }`}
          >
            {saveState === "saving"
              ? t("editor.saving")
              : saveState === "saved" && !dirty
              ? `✓ ${t("editor.saved")}`
              : t("editor.save")}
          </button>
        </div>
      </header>

      <form onSubmit={addStation} className="mb-4 flex flex-wrap gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder={t("editor.stationName")}
          className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-brand"
        />
        <select
          value={newType}
          onChange={(e) => setNewType(e.target.value)}
          className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-brand"
        >
          <option value="PS5">PS5</option>
          <option value="PS4">PS4</option>
        </select>
        <button className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark">
          + {t("editor.addStation")}
        </button>
      </form>

      <p className="mb-2 text-xs text-slate-500">{t("editor.hint")}</p>

      <div className="flex gap-4">
        <div
          ref={canvasRef}
          onPointerMove={onPointerMove}
          className="relative aspect-[16/9] flex-1 touch-none overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60 bg-[radial-gradient(circle,#1e293b_1px,transparent_1px)] [background-size:24px_24px]"
        >
          {stations.length === 0 && (
            <div className="flex h-full items-center justify-center text-slate-500">
              {t("editor.emptyHint")}
            </div>
          )}
          {stations.map((s) => (
            <div
              key={s.id}
              onPointerDown={(e) => onPointerDown(e, s.id)}
              onPointerUp={(e) => onPointerUp(e, s.id)}
              style={{ left: `${s.posX}%`, top: `${s.posY}%` }}
              className={`absolute w-24 -translate-x-1/2 -translate-y-1/2 cursor-grab touch-none select-none rounded-xl border-2 bg-slate-800 p-2 text-center shadow-lg active:cursor-grabbing ${
                selectedId === s.id ? "border-brand" : "border-slate-600"
              }`}
            >
              <div className="truncate text-xs font-semibold text-white">{s.name}</div>
              <div className="text-[10px] text-slate-400">{s.type}</div>
            </div>
          ))}
        </div>

        {selected && (
          <div className="w-56 shrink-0 rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <div className="mb-3 text-sm font-semibold text-white">{selected.name}</div>
            <label className="mb-3 block">
              <span className="mb-1 block text-xs text-slate-400">{t("editor.stationName")}</span>
              <input
                value={selected.name}
                onChange={(e) => patchSelected({ name: e.target.value })}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-brand"
              />
            </label>
            <label className="mb-4 block">
              <span className="mb-1 block text-xs text-slate-400">{t("editor.type")}</span>
              <select
                value={selected.type}
                onChange={(e) => patchSelected({ type: e.target.value })}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-brand"
              >
                <option value="PS5">PS5</option>
                <option value="PS4">PS4</option>
              </select>
            </label>
            <button
              onClick={removeSelected}
              className="w-full rounded-lg border border-rose-700 py-2 text-sm text-rose-400 hover:bg-rose-950"
            >
              {t("editor.remove")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
