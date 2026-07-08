"use client";

import { useI18n } from "@/lib/i18n/LanguageProvider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { createClub as CreateClub, inviteMember as InviteMember } from "./actions";

type Club = { id: string; name: string };

export function AdminPageClient({
  clubs,
  createClub,
  inviteMember,
}: {
  clubs: Club[];
  createClub: typeof CreateClub;
  inviteMember: typeof InviteMember;
}) {
  const { t } = useI18n();

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-6 text-2xl font-bold text-foreground">{t("admin.title")}</h1>

      <Card className="mb-8 p-5">
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
                {clubs.map((c) => (
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
  );
}
