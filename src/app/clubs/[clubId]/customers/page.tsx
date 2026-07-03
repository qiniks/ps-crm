"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import { formatMoney } from "@/lib/format";

type Customer = {
  id: string;
  name: string;
  phone: string | null;
  balance: number;
  bonusPoints: number;
};

export default function CustomersPage() {
  const { t } = useI18n();
  const { clubId } = useParams<{ clubId: string }>();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(`/api/clubs/${clubId}/customers`, { cache: "no-store" });
    setCustomers(await res.json());
  }, [clubId]);

  useEffect(() => {
    // TODO(2026-07-02-tanstack-query-migration.md): this fetch pattern is replaced by useQuery in that plan; suppressing the new rule here rather than hand-restructuring ahead of it.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await fetch(`/api/clubs/${clubId}/customers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, phone }),
    });
    setName("");
    setPhone("");
    load();
  }

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-6 text-2xl font-bold text-white">{t("customers.title")}</h1>

      <form onSubmit={add} className="mb-6 flex flex-wrap gap-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("customers.name")}
          className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-brand"
        />
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder={t("customers.phone")}
          className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-brand"
        />
        <button className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark">
          +
        </button>
      </form>

      <div className="overflow-hidden rounded-xl border border-slate-800">
        <table className="w-full text-sm">
          <thead className="bg-slate-900 text-left text-slate-400">
            <tr>
              <th className="px-4 py-3 font-medium">{t("customers.name")}</th>
              <th className="px-4 py-3 font-medium">{t("customers.phone")}</th>
              <th className="px-4 py-3 font-medium">{t("customers.balance")}</th>
              <th className="px-4 py-3 font-medium">{t("customers.bonus")}</th>
            </tr>
          </thead>
          <tbody>
            {customers.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                  {t("customers.empty")}
                </td>
              </tr>
            ) : (
              customers.map((c) => (
                <tr key={c.id} className="border-t border-slate-800">
                  <td className="px-4 py-3 text-white">{c.name}</td>
                  <td className="px-4 py-3 text-slate-300">{c.phone ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-300">
                    {formatMoney(c.balance)} {t("common.currency")}
                  </td>
                  <td className="px-4 py-3 text-slate-300">{c.bonusPoints}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
