"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { IconEdit, IconSearch, IconTrash, IconUsers } from "@tabler/icons-react";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import { formatMoney } from "@/lib/format";
import { DEFAULT_PAGE_SIZE } from "@/lib/listParams";
import { PageHeader } from "@/components/ui-patterns/page-header";
import { EmptyState } from "@/components/ui-patterns/empty-state";
import { ErrorState } from "@/components/ui-patterns/error-state";
import { Pagination } from "@/components/ui-patterns/pagination";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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

async function updateCustomer(
  customerId: string,
  values: { name: string; phone: string; balance: number; bonusPoints: number }
) {
  const res = await fetch(`/api/customers/${customerId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(values),
  });
  if (!res.ok) throw new Error(`PATCH customer failed: ${res.status}`);
  return res.json();
}

async function deleteCustomer(customerId: string) {
  const res = await fetch(`/api/customers/${customerId}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`DELETE customer failed: ${res.status}`);
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
  const [editing, setEditing] = useState<Customer | null>(null);

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

  const updateMutation = useMutation({
    mutationFn: ({
      customerId,
      values,
    }: {
      customerId: string;
      values: { name: string; phone: string; balance: number; bonusPoints: number };
    }) => updateCustomer(customerId, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers", clubId] });
      setEditing(null);
      toast.success(t("customers.updated"));
    },
    onError: () => toast.error(t("common.error")),
  });

  const deleteMutation = useMutation({
    mutationFn: (customerId: string) => deleteCustomer(customerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers", clubId] });
      toast.success(t("customers.deleted"));
    },
    onError: () => toast.error(t("common.error")),
  });

  function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    addMutation.mutate({ name, phone });
  }

  function remove(c: Customer) {
    if (!window.confirm(t("customers.deleteConfirm"))) return;
    deleteMutation.mutate(c.id);
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
                  <TableHead className="text-right">{t("customers.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
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
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            aria-label={t("common.edit")}
                            onClick={() => setEditing(c)}
                          >
                            <IconEdit className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            aria-label={t("common.delete")}
                            onClick={() => remove(c)}
                          >
                            <IconTrash className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}

      {editing && (
        <EditCustomerDialog
          customer={editing}
          pending={updateMutation.isPending}
          onClose={() => setEditing(null)}
          onSave={(values) => updateMutation.mutate({ customerId: editing.id, values })}
        />
      )}
    </div>
  );
}

function EditCustomerDialog({
  customer,
  pending,
  onClose,
  onSave,
}: {
  customer: Customer;
  pending: boolean;
  onClose: () => void;
  onSave: (values: { name: string; phone: string; balance: number; bonusPoints: number }) => void;
}) {
  const { t } = useI18n();
  const [name, setName] = useState(customer.name);
  const [phone, setPhone] = useState(customer.phone ?? "");
  const [balance, setBalance] = useState(String(customer.balance));
  const [bonusPoints, setBonusPoints] = useState(String(customer.bonusPoints));

  function save() {
    if (!name.trim()) return;
    onSave({
      name,
      phone,
      balance: Math.max(0, Math.round(Number(balance) || 0)),
      bonusPoints: Math.max(0, Math.round(Number(bonusPoints) || 0)),
    });
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("customers.editTitle")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">{t("customers.name")}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">{t("customers.phone")}</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{t("customers.balance")}</Label>
              <Input type="number" min="0" value={balance} onChange={(e) => setBalance(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{t("customers.bonus")}</Label>
              <Input type="number" min="0" value={bonusPoints} onChange={(e) => setBonusPoints(e.target.value)} />
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button className="flex-1" disabled={pending} onClick={save}>
            {t("common.save")}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            {t("common.cancel")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
