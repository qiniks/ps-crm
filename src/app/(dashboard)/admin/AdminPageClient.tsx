"use client";

import { IconLogin2 } from "@tabler/icons-react";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import type {
  createClub as CreateClub,
  impersonateUser as ImpersonateUser,
  inviteMember as InviteMember,
  restoreClub as RestoreClub,
} from "./actions";

type Club = { id: string; name: string; archivedAt: Date | null };

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
  inviteMember,
  impersonateUser,
  restoreClub,
}: {
  clubs: Club[];
  users: AdminUserRow[];
  createClub: typeof CreateClub;
  inviteMember: typeof InviteMember;
  impersonateUser: typeof ImpersonateUser;
  restoreClub: typeof RestoreClub;
}) {
  const { t, locale } = useI18n();
  const activeClubs = clubs.filter((c) => !c.archivedAt);
  const archivedClubs = clubs.filter((c) => c.archivedAt);

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-6 text-2xl font-bold text-foreground">{t("admin.title")}</h1>

      <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card className="p-5">
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

        <Card className="p-5">
          <CardHeader className="p-0 pb-3">
            <CardTitle className="text-lg">{t("admin.inviteMember")}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <form action={inviteMember} className="flex flex-col gap-3">
              <Input name="email" type="email" placeholder={t("auth.email")} required />
              <Select name="tenantId" required>
                <SelectTrigger>
                  <SelectValue placeholder={t("admin.selectClub")} />
                </SelectTrigger>
                <SelectContent>
                  {activeClubs.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button>{t("admin.sendInvite")}</Button>
            </form>
          </CardContent>
        </Card>
      </div>

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

      <h2 className="mb-3 text-lg font-semibold text-foreground">{t("admin.users")}</h2>
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
