"use client";

import Link from "next/link";
import { IconArrowLeft } from "@tabler/icons-react";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";

export type AuditLogRow = {
  id: string;
  actorEmail: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  clubName: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string; // ISO
};

function isShortage(metadata: Record<string, unknown> | null): boolean {
  return metadata?.hasShortage === true;
}

export function AuditLogClient({
  rows,
  page,
  totalPages,
}: {
  rows: AuditLogRow[];
  page: number;
  totalPages: number;
}) {
  const { t, locale } = useI18n();

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("audit.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("audit.subtitle")}</p>
        </div>
        <Button asChild size="sm" variant="outline" className="gap-1.5">
          <Link href="/admin">
            <IconArrowLeft className="h-3.5 w-3.5" />
            {t("audit.backToAdmin")}
          </Link>
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("audit.actor")}</TableHead>
              <TableHead>{t("audit.action")}</TableHead>
              <TableHead>{t("audit.target")}</TableHead>
              <TableHead>{t("audit.club")}</TableHead>
              <TableHead>{t("audit.details")}</TableHead>
              <TableHead className="text-right">{t("audit.when")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  {t("audit.empty")}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="text-foreground">
                    {row.actorEmail ?? t("audit.system")}
                  </TableCell>
                  <TableCell>
                    <code className="text-xs">{row.action}</code>
                    {isShortage(row.metadata) && (
                      <Badge variant="destructive" className="ml-2">
                        {t("audit.shortage")}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.targetType ? (
                      <span>
                        {row.targetType}
                        {row.targetId ? (
                          <code className="ml-1 text-xs">#{row.targetId.slice(0, 8)}</code>
                        ) : null}
                      </span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.clubName ?? t("audit.allClubs")}
                  </TableCell>
                  <TableCell className="max-w-xs truncate text-xs text-muted-foreground" title={row.metadata ? JSON.stringify(row.metadata) : undefined}>
                    {row.metadata ? JSON.stringify(row.metadata) : "—"}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {new Date(row.createdAt).toLocaleString(locale)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <Button asChild size="sm" variant="outline" disabled={page <= 1}>
          <Link
            href={page <= 1 ? "#" : `/admin/audit?page=${page - 1}`}
            aria-disabled={page <= 1}
            className={page <= 1 ? "pointer-events-none opacity-50" : undefined}
          >
            {t("audit.prev")}
          </Link>
        </Button>
        <span className="text-sm text-muted-foreground">
          {t("audit.page")} {page} / {totalPages}
        </span>
        <Button asChild size="sm" variant="outline" disabled={page >= totalPages}>
          <Link
            href={page >= totalPages ? "#" : `/admin/audit?page=${page + 1}`}
            aria-disabled={page >= totalPages}
            className={page >= totalPages ? "pointer-events-none opacity-50" : undefined}
          >
            {t("audit.next")}
          </Link>
        </Button>
      </div>
    </div>
  );
}
