"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { IconUserCog, IconUserPlus } from "@tabler/icons-react";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import { PageHeader } from "@/components/ui-patterns/page-header";
import { EmptyState } from "@/components/ui-patterns/empty-state";
import { ErrorState } from "@/components/ui-patterns/error-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { TranslationKey } from "@/lib/i18n/dictionaries";

type MembershipRole = "OWNER" | "CASHIER";

type Member = {
  id: string;
  userId: string;
  email: string | null;
  role: string;
  pending: boolean;
  isSelf: boolean;
};

type MembersResponse = { canManage: boolean; members: Member[] };

const ROLE_LABEL: Record<MembershipRole, TranslationKey> = {
  OWNER: "members.roleOwner",
  CASHIER: "members.roleCashier",
};

async function fetchMembers(clubId: string): Promise<MembersResponse> {
  const res = await fetch(`/api/clubs/${clubId}/members`, { cache: "no-store" });
  if (!res.ok) throw new Error(`GET members failed: ${res.status}`);
  return res.json();
}

// Always creates a CASHIER — see POST /api/clubs/[clubId]/members, which
// enforces this server-side too. Only the global admin panel can create an
// OWNER.
async function createMember(clubId: string, values: { email: string; password: string }) {
  const res = await fetch(`/api/clubs/${clubId}/members`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(values),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `POST member failed: ${res.status}`);
  }
  return res.json();
}

async function updateMemberRole(clubId: string, membershipId: string, role: MembershipRole) {
  const res = await fetch(`/api/clubs/${clubId}/members/${membershipId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role }),
  });
  if (!res.ok) throw new Error(`PATCH member failed: ${res.status}`);
  return res.json();
}

async function removeMember(clubId: string, membershipId: string) {
  const res = await fetch(`/api/clubs/${clubId}/members/${membershipId}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`DELETE member failed: ${res.status}`);
  return res.json();
}

export default function MembersPage() {
  const { t } = useI18n();
  const { clubId } = useParams<{ clubId: string }>();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["members", clubId],
    queryFn: () => fetchMembers(clubId),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["members", clubId] });

  const createMemberMutation = useMutation({
    mutationFn: (values: { email: string; password: string }) => createMember(clubId, values),
    onSuccess: () => {
      invalidate();
      setEmail("");
      setPassword("");
      setCreateOpen(false);
      toast.success(t("members.created"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const roleMutation = useMutation({
    mutationFn: ({ membershipId, role }: { membershipId: string; role: MembershipRole }) =>
      updateMemberRole(clubId, membershipId, role),
    onSuccess: () => {
      invalidate();
      toast.success(t("members.roleUpdated"));
    },
  });

  const removeMutation = useMutation({
    mutationFn: (membershipId: string) => removeMember(clubId, membershipId),
    onSuccess: () => {
      invalidate();
      toast.success(t("members.removed"));
    },
  });

  function createUser(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || password.length < 8) return;
    createMemberMutation.mutate({ email: email.trim(), password });
  }

  const members = data?.members ?? [];
  const canManage = data?.canManage ?? false;

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title={t("members.title")} subtitle={t("members.subtitle")} />

      {!isLoading && !canManage && (
        <p className="mb-4 text-sm text-muted-foreground">{t("members.readOnlyHint")}</p>
      )}

      {canManage && (
        <div className="mb-6">
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5">
                <IconUserPlus className="h-3.5 w-3.5" />
                {t("members.create")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("members.create")}</DialogTitle>
              </DialogHeader>
              <form onSubmit={createUser} className="flex flex-col gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="new-member-email">{t("auth.email")}</Label>
                  <Input
                    id="new-member-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t("auth.email")}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="new-member-password">{t("auth.password")}</Label>
                  <Input
                    id="new-member-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t("auth.password")}
                    required
                    minLength={8}
                  />
                </div>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button type="button" variant="ghost">
                      {t("common.cancel")}
                    </Button>
                  </DialogClose>
                  <Button disabled={createMemberMutation.isPending}>
                    {createMemberMutation.isPending ? t("common.creating") : t("members.create")}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {isError ? (
        <ErrorState message={t("common.error")} onRetry={() => refetch()} retryLabel={t("common.retry")} />
      ) : !isLoading && members.length === 0 ? (
        <EmptyState icon={<IconUserCog className="h-8 w-8" />} message={t("members.empty")} />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("auth.email")}</TableHead>
                <TableHead>{t("members.role")}</TableHead>
                <TableHead>{t("members.status")}</TableHead>
                {canManage && <TableHead className="text-right">{t("admin.actions")}</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={canManage ? 4 : 3} className="text-center text-muted-foreground">
                    {t("common.loading")}
                  </TableCell>
                </TableRow>
              ) : (
                members.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="text-foreground">
                      {m.email ?? "—"}
                      {m.isSelf && (
                        <Badge variant="secondary" className="ml-2">
                          {t("members.you")}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {canManage && m.role !== "CASHIER" ? (
                        // Only demoting an OWNER to CASHIER is offered here — promoting a
                        // CASHIER to OWNER isn't allowed from this page (see PATCH
                        // /api/clubs/[clubId]/members/[membershipId], which rejects it
                        // server-side too); OWNER is only ever granted via the admin panel.
                        <Select
                          value="OWNER"
                          onValueChange={(v) =>
                            roleMutation.mutate({ membershipId: m.id, role: v as MembershipRole })
                          }
                          disabled={roleMutation.isPending}
                        >
                          <SelectTrigger className="w-36">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="OWNER">{t("members.roleOwner")}</SelectItem>
                            <SelectItem value="CASHIER">{t("members.roleCashier")}</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        t(ROLE_LABEL[m.role === "CASHIER" ? "CASHIER" : "OWNER"])
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={m.pending ? "outline" : "success"}>
                        {m.pending ? t("members.pending") : t("members.active")}
                      </Badge>
                    </TableCell>
                    {canManage && (
                      <TableCell className="text-right">
                        {!m.isSelf && (
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={removeMutation.isPending}
                            onClick={() => removeMutation.mutate(m.id)}
                          >
                            {t("members.remove")}
                          </Button>
                        )}
                      </TableCell>
                    )}
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
