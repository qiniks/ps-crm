"use client";

import { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import { formatMoney } from "@/lib/format";

type Customer = {
  id: string;
  name: string;
  phone: string | null;
  balance: number;
  bonusPoints: number;
  createdAt: string;
};

export default function CustomersPage() {
  const { t, locale } = useI18n();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/customers", { cache: "no-store" });
    setCustomers(await res.json());
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await fetch("/api/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, phone }),
    });
    setName("");
    setPhone("");
    load();
  }

  return (
    <div>
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
              <th className="px-4 py-3 font-medium">{t("customers.since")}</th>
            </tr>
          </thead>
          <tbody>
            {customers.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
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
                  <td className="px-4 py-3 text-slate-400">
                    {new Date(c.createdAt).toLocaleDateString(locale)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
