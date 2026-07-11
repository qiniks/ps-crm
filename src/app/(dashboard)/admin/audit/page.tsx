import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { isAdminUser } from "@/lib/auth/impersonation";
import { AuditLogClient, type AuditLogRow } from "./AuditLogClient";

const PAGE_SIZE = 25;

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const user = await getSessionUser();
  if (!isAdminUser(user)) {
    redirect("/clubs");
  }

  const { page: pageParam } = await searchParams;
  const requestedPage = Number(pageParam ?? "1");
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? Math.floor(requestedPage) : 1;

  const [total, entries] = await Promise.all([
    prisma.auditLog.count(),
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { tenant: { select: { name: true } } },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const rows: AuditLogRow[] = entries.map((e) => ({
    id: e.id,
    actorEmail: e.actorEmail,
    action: e.action,
    targetType: e.targetType,
    targetId: e.targetId,
    clubName: e.tenant?.name ?? null,
    metadata: (e.metadata as Record<string, unknown> | null) ?? null,
    createdAt: e.createdAt.toISOString(),
  }));

  return <AuditLogClient rows={rows} page={page} totalPages={totalPages} />;
}
