// Pure parsing/validation for list-endpoint query params (search + pagination).
// Shared by any route that lists tenant-scoped rows (customers, clubs, ...)
// so every list is bounded — see CLAUDE.md issue #12: several `findMany`
// calls used to have no `take`/`skip` at all.

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export type ListParams = {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
  search: string;
};

function parsePositiveInt(raw: string | null, fallback: number, max?: number): number {
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n) || n < 1) return fallback;
  return max != null ? Math.min(n, max) : n;
}

// Reads `page`, `pageSize`, and `q` from the request's search params. Invalid
// or missing `page`/`pageSize` fall back to sane defaults rather than
// erroring — this is a listing UI, not a strict API contract. `pageSize` is
// clamped to MAX_PAGE_SIZE so a client can't force an unbounded query.
export function parseListParams(searchParams: URLSearchParams): ListParams {
  const page = parsePositiveInt(searchParams.get("page"), 1);
  const pageSize = parsePositiveInt(searchParams.get("pageSize"), DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const search = (searchParams.get("q") ?? "").trim();

  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize, search };
}
