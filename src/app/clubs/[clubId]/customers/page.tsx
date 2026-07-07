"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { IconUsers } from "@tabler/icons-react";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import { formatMoney } from "@/lib/format";
import { PageHeader } from "@/components/ui-patterns/page-header";
import { EmptyState } from "@/components/ui-patterns/empty-state";
import { ErrorState } from "@/components/ui-patterns/error-state";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";

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
    refetch,
  } = useQuery({ queryKey: ["customers", clubId], queryFn: () => fetchCustomers(clubId) });

  const addMutation = useMutation({
    mutationFn: (values: { name: string; phone: string }) => createCustomer(clubId, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers", clubId] });
      setName("");
      setPhone("");
      toast.success(t("customers.created"));
    },
  });

  function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    addMutation.mutate({ name, phone });
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title={t("customers.title")} />

      <form onSubmit={add} className="mb-6 flex flex-wrap gap-3">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("customers.name")} className="max-w-xs" />
        <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t("customers.phone")} className="max-w-xs" />
        <Button disabled={addMutation.isPending}>+</Button>
      </form>

      {isError ? (
        <ErrorState message={t("common.error")} onRetry={() => refetch()} retryLabel={t("common.retry")} />
      ) : !isLoading && customers.length === 0 ? (
        <EmptyState icon={<IconUsers className="h-8 w-8" />} message={t("customers.empty")} />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("customers.name")}</TableHead>
                <TableHead>{t("customers.phone")}</TableHead>
                <TableHead>{t("customers.balance")}</TableHead>
                <TableHead>{t("customers.bonus")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    {t("common.loading")}
                  </TableCell>
                </TableRow>
              ) : (
                customers.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="text-foreground">{c.name}</TableCell>
                    <TableCell className="text-muted-foreground">{c.phone ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatMoney(c.balance)} {t("common.currency")}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{c.bonusPoints}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
