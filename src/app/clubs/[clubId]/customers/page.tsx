"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import { formatMoney } from "@/lib/format";

type Customer = { id: string; name: string; phone: string | null; balance: number; bonusPoints: number };

async function fetchCustomers(clubId: string): Promise<Customer[]> {
  const res = await fetch(`/api/clubs/${clubId}/customers`, { cache: "no-store" });
  if (!res.ok) throw new Error(`GET customers failed: ${res.status}`);
  return res.json();
}

async function createCustomer(clubId: string, values: { name: string; phone: string }) {
  const res = await fetch(`/api/clubs/${clubId}/customers`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(values),
  });
  if (!res.ok) throw new Error(`POST customer failed: ${res.status}`);
  return res.json();
}

export default function CustomersPage() {
  const { t } = useI18n();
  const { clubId } = useParams<{ clubId: string }>();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const {
    data: customers = [],
    isLoading,
    isError,
  } = useQuery({ queryKey: ["customers", clubId], queryFn: () => fetchCustomers(clubId) });

  const addMutation = useMutation({
    mutationFn: (values: { name: string; phone: string }) => createCustomer(clubId, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers", clubId] });
      setName("");
      setPhone("");
    },
  });

  function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    addMutation.mutate({ name, phone });
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
        <button
          disabled={addMutation.isPending}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50"
        >
          +
        </button>
      </form>

      {isError ? (
        <div className="rounded-xl border border-dashed border-red-800 p-10 text-center text-red-400">
          {t("common.error")}
        </div>
      ) : (
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
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                    {t("common.loading")}
                  </td>
                </tr>
              ) : customers.length === 0 ? (
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
      )}
    </div>
  );
}
