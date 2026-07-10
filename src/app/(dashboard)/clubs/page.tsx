"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { IconDeviceGamepad2 } from "@tabler/icons-react";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import { PageHeader } from "@/components/ui-patterns/page-header";
import { EmptyState } from "@/components/ui-patterns/empty-state";
import { ErrorState } from "@/components/ui-patterns/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

type Club = { id: string; name: string; roomCount: number };

async function fetchClubs(): Promise<Club[]> {
  const res = await fetch("/api/clubs", { cache: "no-store" });
  if (!res.ok) throw new Error(`GET /api/clubs failed: ${res.status}`);
  return res.json();
}

export default function ClubsPage() {
  const { t } = useI18n();
  const router = useRouter();
  const {
    data: clubs = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({ queryKey: ["clubs"], queryFn: fetchClubs });

  // Skip the picker entirely when the user only belongs to one club.
  useEffect(() => {
    if (clubs.length === 1) router.replace(`/clubs/${clubs[0].id}`);
  }, [clubs, router]);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title={t("clubs.title")} subtitle={t("clubs.subtitle")} />

      {isLoading || clubs.length === 1 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : isError ? (
        <ErrorState message={t("common.error")} onRetry={() => refetch()} retryLabel={t("common.retry")} />
      ) : clubs.length === 0 ? (
        <EmptyState icon={<IconDeviceGamepad2 className="h-8 w-8" />} message={t("clubs.empty")} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {clubs.map((c) => (
            <Link key={c.id} href={`/clubs/${c.id}`} className="group">
              <Card className="p-5 transition hover:border-primary">
                <IconDeviceGamepad2 className="h-6 w-6 text-primary" />
                <div className="mt-2 font-semibold text-foreground group-hover:text-primary">{c.name}</div>
                <div className="text-sm text-muted-foreground">
                  {c.roomCount} {t("clubs.roomsCount")}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
