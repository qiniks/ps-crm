"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n/LanguageProvider";

type Club = { id: string; name: string; roomCount: number };

async function fetchClubs(): Promise<Club[]> {
  const res = await fetch("/api/clubs", { cache: "no-store" });
  if (!res.ok) throw new Error(`GET /api/clubs failed: ${res.status}`);
  return res.json();
}

export default function ClubsPage() {
  const { t } = useI18n();
  const {
    data: clubs = [],
    isLoading,
    isError,
  } = useQuery({ queryKey: ["clubs"], queryFn: fetchClubs });

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-white">{t("clubs.title")}</h1>
        <p className="text-sm text-slate-400">{t("clubs.subtitle")}</p>
      </header>

      {isLoading ? (
        <div className="text-slate-400">{t("common.loading")}</div>
      ) : isError ? (
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
