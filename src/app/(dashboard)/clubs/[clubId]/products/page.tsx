"use client";

import { useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { IconEdit, IconMinus, IconPackage, IconPhoto, IconPlus, IconTrash } from "@tabler/icons-react";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import { formatMoney } from "@/lib/format";
import { MAX_PAGE_SIZE } from "@/lib/listParams";
import { canPayFromBalance, PAYMENT_METHODS, type PaymentMethod } from "@/lib/shifts";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/ui-patterns/page-header";
import { EmptyState } from "@/components/ui-patterns/empty-state";
import { ErrorState } from "@/components/ui-patterns/error-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { TranslationKey } from "@/lib/i18n/dictionaries";

type Product = { id: string; name: string; price: number; stock: number; imageUrl: string | null };
type Customer = { id: string; name: string; balance: number };
type CartLine = { productId: string; name: string; unitPrice: number; quantity: number };

const NONE = "__none__";
const EMPTY_FORM = { name: "", price: "", stock: "", imageUrl: "" };

async function fetchProducts(clubId: string): Promise<Product[]> {
  const res = await fetch(`/api/clubs/${clubId}/products`, { cache: "no-store" });
  if (!res.ok) throw new Error(`GET products failed: ${res.status}`);
  return res.json();
}

async function fetchCustomers(clubId: string): Promise<Customer[]> {
  const res = await fetch(`/api/clubs/${clubId}/customers?pageSize=${MAX_PAGE_SIZE}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`GET customers failed: ${res.status}`);
  const data = (await res.json()) as { items: Customer[] };
  return data.items;
}

async function saveProduct(clubId: string, editingId: string | null, values: typeof EMPTY_FORM) {
  const res = await fetch(editingId ? `/api/products/${editingId}` : `/api/clubs/${clubId}/products`, {
    method: editingId ? "PATCH" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(values),
  });
  if (!res.ok) throw new Error(`${editingId ? "PATCH" : "POST"} product failed: ${res.status}`);
  return res.json();
}

async function deleteProduct(productId: string) {
  const res = await fetch(`/api/products/${productId}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`DELETE product failed: ${res.status}`);
  return res.json();
}

async function uploadProductImage(clubId: string, file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`/api/clubs/${clubId}/products/upload-image`, { method: "POST", body: form });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(typeof body.error === "string" ? body.error : `upload-image failed: ${res.status}`);
  }
  const data = (await res.json()) as { url: string };
  return data.url;
}

async function checkoutCart(
  clubId: string,
  values: { items: { productId: string; quantity: number }[]; paymentMethod: PaymentMethod; customerId?: string }
) {
  const res = await fetch(`/api/clubs/${clubId}/sales`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(values),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(typeof body.error === "string" ? body.error : `POST sales failed: ${res.status}`);
  }
  return res.json();
}

export default function ProductsPage() {
  const { t } = useI18n();
  const { clubId } = useParams<{ clubId: string }>();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState(EMPTY_FORM);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Product | null>(null);
  const [uploading, setUploading] = useState(false);

  const [cart, setCart] = useState<CartLine[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [customerId, setCustomerId] = useState(NONE);

  const {
    data: products = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({ queryKey: ["products", clubId], queryFn: () => fetchProducts(clubId) });

  const { data: customers = [] } = useQuery({
    queryKey: ["customers", "picker", clubId],
    queryFn: () => fetchCustomers(clubId),
  });

  const saveMutation = useMutation({
    mutationFn: (values: typeof EMPTY_FORM) => saveProduct(clubId, editing?.id ?? null, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products", clubId] });
      setDialogOpen(false);
      setEditing(null);
      setForm(EMPTY_FORM);
    },
    onError: () => toast.error(t("common.error")),
  });

  const deleteMutation = useMutation({
    mutationFn: (productId: string) => deleteProduct(productId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products", clubId] });
      setPendingDelete(null);
      toast.success(t("product.archived"));
    },
    onError: () => toast.error(t("common.error")),
  });

  const selectedCustomer = customerId === NONE ? null : customers.find((c) => c.id === customerId) ?? null;
  const cartTotal = cart.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
  const balanceEligible = canPayFromBalance(selectedCustomer, cartTotal);
  const effectiveMethod: PaymentMethod = paymentMethod === "BALANCE" && !balanceEligible ? "CASH" : paymentMethod;

  const checkoutMutation = useMutation({
    mutationFn: () =>
      checkoutCart(clubId, {
        items: cart.map((l) => ({ productId: l.productId, quantity: l.quantity })),
        paymentMethod: effectiveMethod,
        customerId: customerId === NONE ? undefined : customerId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products", clubId] });
      queryClient.invalidateQueries({ queryKey: ["shifts", clubId] });
      setCart([]);
      setCustomerId(NONE);
      setPaymentMethod("CASH");
      toast.success(t("cart.checkoutSuccess"));
    },
    onError: () => toast.error(t("cart.checkoutFailed")),
  });

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(p: Product) {
    setEditing(p);
    setForm({ name: p.name, price: String(p.price), stock: String(p.stock), imageUrl: p.imageUrl ?? "" });
    setDialogOpen(true);
  }

  function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    saveMutation.mutate(form);
  }

  async function onFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadProductImage(clubId, file);
      setForm((f) => ({ ...f, imageUrl: url }));
    } catch {
      toast.error(t("product.uploadFailed"));
    } finally {
      setUploading(false);
    }
  }

  function addToCart(p: Product) {
    setCart((c) => {
      const existing = c.find((l) => l.productId === p.id);
      if (existing) {
        return c.map((l) => (l.productId === p.id ? { ...l, quantity: l.quantity + 1 } : l));
      }
      return [...c, { productId: p.id, name: p.name, unitPrice: p.price, quantity: 1 }];
    });
  }

  function changeQuantity(productId: string, delta: number) {
    setCart((c) =>
      c
        .map((l) => (l.productId === productId ? { ...l, quantity: l.quantity + delta } : l))
        .filter((l) => l.quantity > 0)
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={t("product.title")}
        subtitle={t("product.subtitle")}
        actions={<Button onClick={openCreate}>+ {t("product.add")}</Button>}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <div>
          {isLoading ? (
            <div className="text-muted-foreground">{t("common.loading")}</div>
          ) : isError ? (
            <ErrorState message={t("common.error")} onRetry={() => refetch()} retryLabel={t("common.retry")} />
          ) : products.length === 0 ? (
            <EmptyState icon={<IconPackage className="h-8 w-8" />} message={t("product.empty")} />
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {products.map((p) => (
                <Card key={p.id} className="flex flex-col p-4">
                  <div className="mb-3 flex h-24 items-center justify-center overflow-hidden rounded-lg bg-muted">
                    {p.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.imageUrl} alt={p.name} className="h-full w-full object-cover" />
                    ) : (
                      <IconPhoto className="h-8 w-8 text-muted-foreground/50" />
                    )}
                  </div>
                  <div className="font-semibold text-foreground">{p.name}</div>
                  <div className="mt-1 text-sm text-success">
                    {formatMoney(p.price)} {t("common.currency")}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {t("product.stock")}: {p.stock}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" className="flex-1" disabled={p.stock <= 0} onClick={() => addToCart(p)}>
                      {p.stock <= 0 ? t("product.outOfStock") : t("product.addToCart")}
                    </Button>
                    <Button size="icon" variant="outline" aria-label={t("product.edit")} onClick={() => openEdit(p)}>
                      <IconEdit className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      aria-label={t("product.delete")}
                      onClick={() => setPendingDelete(p)}
                    >
                      <IconTrash className="h-4 w-4" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        <Card className="h-fit p-4">
          <div className="mb-3 font-semibold text-foreground">{t("cart.title")}</div>
          {cart.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("cart.empty")}</p>
          ) : (
            <div className="flex flex-col gap-2">
              {cart.map((l) => (
                <div key={l.productId} className="flex items-center justify-between gap-2 text-sm">
                  <span className="flex-1 text-foreground">{l.name}</span>
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-6 w-6"
                      aria-label={t("cart.decreaseQuantity")}
                      onClick={() => changeQuantity(l.productId, -1)}
                    >
                      <IconMinus className="h-3 w-3" />
                    </Button>
                    <span className="w-5 text-center">{l.quantity}</span>
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-6 w-6"
                      aria-label={t("cart.increaseQuantity")}
                      onClick={() => changeQuantity(l.productId, 1)}
                    >
                      <IconPlus className="h-3 w-3" />
                    </Button>
                  </div>
                  <span className="w-16 text-right text-muted-foreground">
                    {formatMoney(l.unitPrice * l.quantity)}
                  </span>
                </div>
              ))}

              <div className="mt-2 flex justify-between border-t border-border pt-2 font-semibold text-foreground">
                <span>{t("cart.total")}</span>
                <span>
                  {formatMoney(cartTotal)} {t("common.currency")}
                </span>
              </div>

              <div className="mt-2 space-y-1.5">
                <Label className="text-xs text-muted-foreground">{t("cart.customer")}</Label>
                <Select value={customerId} onValueChange={setCustomerId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>{t("cart.customerNone")}</SelectItem>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="mt-2 grid grid-cols-3 gap-1.5">
                {PAYMENT_METHODS.map((m) => {
                  const disabled = m === "BALANCE" && !balanceEligible;
                  return (
                    <Button
                      key={m}
                      type="button"
                      size="sm"
                      variant={effectiveMethod === m ? "default" : "outline"}
                      disabled={disabled}
                      className={cn(effectiveMethod !== m && "text-muted-foreground")}
                      onClick={() => setPaymentMethod(m)}
                    >
                      {t(`payment.${m}` as TranslationKey)}
                    </Button>
                  );
                })}
              </div>

              <Button className="mt-2" disabled={checkoutMutation.isPending} onClick={() => checkoutMutation.mutate()}>
                {t("cart.checkout")}
              </Button>
            </div>
          )}
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? t("product.edit") : t("product.add")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={save} className="flex flex-col gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="product-name">{t("product.name")}</Label>
              <Input
                id="product-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="product-price">
                  {t("product.price")} ({t("common.currency")})
                </Label>
                <Input
                  id="product-price"
                  type="number"
                  min="0"
                  value={form.price}
                  onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="product-stock">{t("product.stock")}</Label>
                <Input
                  id="product-stock"
                  type="number"
                  value={form.stock}
                  onChange={(e) => setForm((f) => ({ ...f, stock: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{t("product.image")}</Label>
              <div className="flex items-center gap-3">
                {form.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={form.imageUrl} alt="" className="h-12 w-12 rounded-md object-cover" />
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {uploading ? t("product.uploading") : t("product.uploadImage")}
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={onFileSelected}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button disabled={saveMutation.isPending || uploading}>
                {editing ? t("common.save") : t("common.create")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("product.deleteConfirmTitle")}</DialogTitle>
            <DialogDescription>{t("product.deleteConfirmBody")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPendingDelete(null)}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => pendingDelete && deleteMutation.mutate(pendingDelete.id)}
            >
              {t("common.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
