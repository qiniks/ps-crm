"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { IconSearch, IconUsers } from "@tabler/icons-react";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import { formatMoney } from "@/lib/format";
import { DEFAULT_PAGE_SIZE } from "@/lib/listParams";
import { PageHeader } from "@/components/ui-patterns/page-header";
import { EmptyState } from "@/components/ui-patterns/empty-state";
import { ErrorState } from "@/components/ui-patterns/error-state";
import { Pagination } from "@/components/ui-patterns/pagination";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";

type Customer = { id: string; name: string; phone: string | null; balance: number; bonusPoints: number };
type CustomersResponse = { items: Customer[]; total: number; page: number; pageSize: number };

async function fetchCustomers(clubId: string, page: number, search: string): Promise<CustomersResponse> {
  const params = new URLSearchParams({ page: String(page) });
  if (search) params.set("q", search);
  const res = await fetch(`/api/clubs/${clubId}/customers?${params}`, { cache: "no-store" });
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
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);

  // Debounce the search box so we don't fire a request per keystroke, and
  // restart pagination at page 1 once the debounced term actually changes.
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const {
    data,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["customers", clubId, page, debouncedSearch],
    queryFn: () => fetchCustomers(clubId, page, debouncedSearch),
  });

  const customers = data?.items ?? [];
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / (data?.pageSize ?? DEFAULT_PAGE_SIZE)));

  const addMutation = useMutation({
    mutationFn: (values: { name: string; phone: string }) => createCustomer(clubId, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers", clubId] });
      // Also invalidate the BookingModal's separate picker cache entry (see
      // its comment) so a newly added customer shows up there right away.
      queryClient.invalidateQueries({ queryKey: ["customers", "picker", clubId] });
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

      <div className="relative mb-4 max-w-sm">
        <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("customers.searchPlaceholder")}
          className="pl-9"
        />
      </div>

      {isError ? (
        <ErrorState message={t("common.error")} onRetry={() => refetch()} retryLabel={t("common.retry")} />
      ) : !isLoading && customers.length === 0 ? (
        <EmptyState
          icon={<IconUsers className="h-8 w-8" />}
          message={debouncedSearch ? t("common.noResults") : t("customers.empty")}
        />
      ) : (
        <>
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
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
