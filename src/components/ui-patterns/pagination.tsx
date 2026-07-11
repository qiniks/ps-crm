import { useI18n } from "@/lib/i18n/LanguageProvider";
import { Button } from "@/components/ui/button";

// Prev/next pager for `skip`/`take`-paginated list endpoints (see
// src/lib/listParams.ts). Deliberately simple — no direct page-number
// jumping — since none of this app's lists are expected to run to
// hundreds of pages.
export function Pagination({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  const { t } = useI18n();
  if (totalPages <= 1) return null;

  return (
    <div className="mt-4 flex items-center justify-center gap-3">
      <Button
        variant="outline"
        size="sm"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        {t("common.previous")}
      </Button>
      <span className="text-sm text-muted-foreground">
        {t("common.page")} {page} / {totalPages}
      </span>
      <Button
        variant="outline"
        size="sm"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        {t("common.next")}
      </Button>
    </div>
  );
}
