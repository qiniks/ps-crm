"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n/LanguageProvider";

type Club = { id: string; name: string; roomCount: number };

export default function ClubsPage() {
  const { t } = useI18n();
  const [clubs, setClubs] = useState<Club[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/clubs", { cache: "no-store" });
      if (!res.ok) throw new Error(`GET /api/clubs failed: ${res.status}`);
      setClubs(await res.json());
    } catch (err) {
      console.error(err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // TODO(2026-07-02-tanstack-query-migration.md): this fetch pattern is replaced by useQuery in that plan; suppressing the new rule here rather than hand-restructuring ahead of it.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await fetch("/api/clubs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setName("");
    load();
  }

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-white">{t("clubs.title")}</h1>
        <p className="text-sm text-slate-400">{t("clubs.subtitle")}</p>
      </header>

      <form onSubmit={create} className="mb-8 flex gap-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("clubs.name")}
          className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-brand"
        />
        <button className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark">
          {t("clubs.create")}
        </button>
      </form>

      {loading ? (
        <div className="text-slate-400">{t("common.loading")}</div>
      ) : error ? (
        <div className="rounded-xl border border-dashed border-red-800 p-10 text-center text-red-400">
          {t("common.error")}
        </div>
      ) : clubs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-700 p-10 text-center text-slate-500">
          {t("clubs.empty")}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {clubs.map((c) => (
            <Link
              key={c.id}
              href={`/clubs/${c.id}`}
              className="group rounded-xl border border-slate-800 bg-slate-900 p-5 transition hover:border-brand"
            >
              <div className="text-2xl">🎮</div>
              <div className="mt-2 font-semibold text-white group-hover:text-brand">
                {c.name}
              </div>
              <div className="text-sm text-slate-400">
                {c.roomCount} {t("clubs.roomsCount")}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
