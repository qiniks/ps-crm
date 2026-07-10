import { describe, expect, it } from "vitest";
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, parseListParams } from "./listParams";

describe("parseListParams", () => {
  it("applies defaults when no params are given", () => {
    expect(parseListParams(new URLSearchParams())).toEqual({
      page: 1,
      pageSize: DEFAULT_PAGE_SIZE,
      skip: 0,
      take: DEFAULT_PAGE_SIZE,
      search: "",
    });
  });

  it("computes skip from page and pageSize", () => {
    const result = parseListParams(new URLSearchParams({ page: "3", pageSize: "10" }));
    expect(result).toEqual({ page: 3, pageSize: 10, skip: 20, take: 10, search: "" });
  });

  it("trims and passes through the search query", () => {
    const result = parseListParams(new URLSearchParams({ q: "  ivan  " }));
    expect(result.search).toBe("ivan");
  });

  it("treats a whitespace-only search as empty", () => {
    const result = parseListParams(new URLSearchParams({ q: "   " }));
    expect(result.search).toBe("");
  });

  it("falls back to page 1 for non-positive or non-numeric page values", () => {
    expect(parseListParams(new URLSearchParams({ page: "0" })).page).toBe(1);
    expect(parseListParams(new URLSearchParams({ page: "-5" })).page).toBe(1);
    expect(parseListParams(new URLSearchParams({ page: "abc" })).page).toBe(1);
  });

  it("floors fractional page and pageSize values", () => {
    const result = parseListParams(new URLSearchParams({ page: "2.9", pageSize: "5.9" }));
    expect(result.page).toBe(2);
    expect(result.pageSize).toBe(5);
  });

  it("falls back to the default page size for non-positive or non-numeric values", () => {
    expect(parseListParams(new URLSearchParams({ pageSize: "0" })).pageSize).toBe(DEFAULT_PAGE_SIZE);
    expect(parseListParams(new URLSearchParams({ pageSize: "-3" })).pageSize).toBe(DEFAULT_PAGE_SIZE);
    expect(parseListParams(new URLSearchParams({ pageSize: "xyz" })).pageSize).toBe(DEFAULT_PAGE_SIZE);
  });

  it("clamps an oversized page size to MAX_PAGE_SIZE", () => {
    const result = parseListParams(new URLSearchParams({ pageSize: "10000" }));
    expect(result.pageSize).toBe(MAX_PAGE_SIZE);
    expect(result.take).toBe(MAX_PAGE_SIZE);
  });
});
