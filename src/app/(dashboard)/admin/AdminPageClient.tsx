"use client";

import { useState } from "react";
import Link from "next/link";
import { IconLogin2, IconHistory, IconUserPlus } from "@tabler/icons-react";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import type {
  createClub as CreateClub,
  createMember as CreateMember,
  impersonateUser as ImpersonateUser,
  restoreClub as RestoreClub,
} from "./actions";

type Club = { id: string; name: string; archivedAt: Date | null };

function CreateMemberDialog({
  clubs,
  createMember,
}: {
  clubs: Club[];
  createMember: typeof CreateMember;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    const result = await createMember({ error: null }, formData);
    setPending(false);
    if (result.error) {
      setError(result.error);
    } else {
      setOpen(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setError(null);
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <IconUserPlus className="h-3.5 w-3.5" />
          {t("admin.createUser")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("admin.createMember")}</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="flex flex-col gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="member-email">{t("auth.email")}</Label>
            <Input id="member-email" name="email" type="email" placeholder={t("auth.email")} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="member-password">{t("auth.password")}</Label>
            <Input
              id="member-password"
              name="password"
              type="password"
              placeholder={t("auth.password")}
              required
              minLength={8}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t("admin.selectClub")}</Label>
            <Select name="tenantId" required>
              <SelectTrigger>
                <SelectValue placeholder={t("admin.selectClub")} />
              </SelectTrigger>
              <SelectContent>
                {clubs.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{t("members.role")}</Label>
            <Select name="role" defaultValue="CASHIER">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CASHIER">{t("members.roleCashier")}</SelectItem>
                <SelectItem value="OWNER">{t("members.roleOwner")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {error && <div className="text-sm text-destructive">{error}</div>}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                {t("common.cancel")}
              </Button>
            </DialogClose>
            <Button disabled={pending}>{pending ? t("common.creating") : t("admin.createUser")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export type AdminUserRow = {
  id: string;
  email: string | null;
  lastSignInAt: string | null;
  tenants: string[];
  isAdmin: boolean;
};

export function AdminPageClient({
  clubs,
  users,
  createClub,
  createMember,
  impersonateUser,
  restoreClub,
}: {
  clubs: Club[];
  users: AdminUserRow[];
  createClub: typeof CreateClub;
  createMember: typeof CreateMember;
  impersonateUser: typeof ImpersonateUser;
  restoreClub: typeof RestoreClub;
}) {
  const { t, locale } = useI18n();
  const activeClubs = clubs.filter((c) => !c.archivedAt);
  const archivedClubs = clubs.filter((c) => c.archivedAt);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">{t("admin.title")}</h1>
        <Button asChild size="sm" variant="outline" className="gap-1.5">
          <Link href="/admin/audit">
            <IconHistory className="h-3.5 w-3.5" />
            {t("admin.viewAuditLog")}
          </Link>
        </Button>
      </div>

      <Card className="mb-8 max-w-md p-5">
        <CardHeader className="p-0 pb-3">
          <CardTitle className="text-lg">{t("admin.createClub")}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <form action={createClub} className="flex gap-3">
            <Input name="name" placeholder={t("clubs.name")} required className="flex-1" />
            <Button>{t("common.create")}</Button>
          </form>
        </CardContent>
      </Card>

      {archivedClubs.length > 0 && (
        <>
          <h2 className="mb-3 text-lg font-semibold text-foreground">{t("admin.archivedClubs")}</h2>
          <div className="mb-8 overflow-hidden rounded-xl border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("clubs.name")}</TableHead>
                  <TableHead className="text-right">{t("admin.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {archivedClubs.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="text-foreground">
                      {c.name}
                      <Badge variant="secondary" className="ml-2">
                        {t("admin.archivedBadge")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <form action={restoreClub} className="inline-flex">
                        <input type="hidden" name="tenantId" value={c.id} />
                        <Button size="sm" variant="outline">
                          {t("admin.restore")}
                        </Button>
                      </form>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">{t("admin.users")}</h2>
        <CreateMemberDialog clubs={activeClubs} createMember={createMember} />
      </div>
      <div className="overflow-hidden rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("auth.email")}</TableHead>
              <TableHead>{t("nav.clubs")}</TableHead>
              <TableHead>{t("admin.lastSignIn")}</TableHead>
              <TableHead className="text-right">{t("admin.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  {t("admin.noUsers")}
                </TableCell>
              </TableRow>
            ) : (
              users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="text-foreground">
                    {u.email ?? "—"}
                    {u.isAdmin && (
                      <Badge variant="secondary" className="ml-2">
                        {t("admin.adminBadge")}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {u.tenants.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {u.tenants.map((name) => (
                          <Badge key={name} variant="outline">
                            {name}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      t("admin.noTenants")
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {u.lastSignInAt ? new Date(u.lastSignInAt).toLocaleString(locale) : t("admin.never")}
                  </TableCell>
                  <TableCell className="text-right">
                    {!u.isAdmin && (
                      <form action={impersonateUser} className="inline-flex">
                        <input type="hidden" name="userId" value={u.id} />
                        <input type="hidden" name="email" value={u.email ?? ""} />
                        <Button size="sm" variant="outline" className="gap-1.5">
                          <IconLogin2 className="h-3.5 w-3.5" />
                          {t("admin.loginAs")}
                        </Button>
                      </form>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
