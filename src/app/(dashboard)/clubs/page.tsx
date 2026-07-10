"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { IconDeviceGamepad2, IconSearch } from "@tabler/icons-react";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import { DEFAULT_PAGE_SIZE } from "@/lib/listParams";
import { PageHeader } from "@/components/ui-patterns/page-header";
import { EmptyState } from "@/components/ui-patterns/empty-state";
import { ErrorState } from "@/components/ui-patterns/error-state";
import { Pagination } from "@/components/ui-patterns/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type Club = { id: string; name: string; roomCount: number };
type ClubsResponse = { items: Club[]; total: number; page: number; pageSize: number };

async function fetchClubs(page: number, search: string): Promise<ClubsResponse> {
  const params = new URLSearchParams({ page: String(page) });
  if (search) params.set("q", search);
  const res = await fetch(`/api/clubs?${params}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`GET /api/clubs failed: ${res.status}`);
  return res.json();
}

export default function ClubsPage() {
  const { t } = useI18n();
  const router = useRouter();
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
    queryKey: ["clubs", page, debouncedSearch],
    queryFn: () => fetchClubs(page, debouncedSearch),
  });

  const clubs = data?.items ?? [];
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / (data?.pageSize ?? DEFAULT_PAGE_SIZE)));
  // Skip the picker entirely when the user only belongs to one club overall
  // (not just one match for the current search).
  const onlyClubId = clubs.length === 1 ? clubs[0].id : undefined;
  const skipToOnlyClub = !debouncedSearch && data?.total === 1 && onlyClubId != null;

  useEffect(() => {
    if (skipToOnlyClub && onlyClubId) router.replace(`/clubs/${onlyClubId}`);
  }, [skipToOnlyClub, onlyClubId, router]);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title={t("clubs.title")} subtitle={t("clubs.subtitle")} />

      <div className="relative mb-4 max-w-sm">
        <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("clubs.searchPlaceholder")}
          className="pl-9"
        />
      </div>

      {isLoading || skipToOnlyClub ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : isError ? (
        <ErrorState message={t("common.error")} onRetry={() => refetch()} retryLabel={t("common.retry")} />
      ) : clubs.length === 0 ? (
        <EmptyState
          icon={<IconDeviceGamepad2 className="h-8 w-8" />}
          message={debouncedSearch ? t("common.noResults") : t("clubs.empty")}
        />
      ) : (
        <>
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
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
