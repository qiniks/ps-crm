import { resolveDateRange, type DateRange, type DateRangePreset } from "@/lib/time";

const VALID_PRESETS: readonly DateRangePreset[] = ["today", "week", "month", "custom"];

function isPreset(value: string | null): value is DateRangePreset {
  return value !== null && (VALID_PRESETS as readonly string[]).includes(value);
}

// Reads ?preset=&from=&to= off a request's search params and resolves them to
// a concrete date range via resolveDateRange(). Falls back to `defaultPreset`
// when the preset is missing/unrecognized, or when preset=custom is missing
// (or has unparsable) from/to values — callers should never 500 just because
// the query string was malformed.
export function parseDateRangeParams(
  searchParams: URLSearchParams,
  defaultPreset: DateRangePreset
): DateRange {
  const presetParam = searchParams.get("preset");
  const preset = isPreset(presetParam) ? presetParam : defaultPreset;

  try {
    return resolveDateRange(preset, {
      from: searchParams.get("from") ?? undefined,
      to: searchParams.get("to") ?? undefined,
    });
  } catch {
    return resolveDateRange(defaultPreset);
  }
}
