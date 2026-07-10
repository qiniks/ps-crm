"use client";

import { useI18n } from "@/lib/i18n/LanguageProvider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { localDayKey, type DateRangePreset } from "@/lib/time";

export type { DateRangePreset };

// Client-side representation of the selected range: `preset` drives the
// server-side boundary calc (see src/lib/time.ts#resolveDateRange); `from`/
// `to` (YYYY-MM-DD) are only meaningful — and only sent to the API — when
// preset is "custom".
export interface DateRangeValue {
  preset: DateRangePreset;
  from: string;
  to: string;
}

export function defaultDateRangeValue(preset: DateRangePreset = "today"): DateRangeValue {
  const today = localDayKey(new Date());
  return { preset, from: today, to: today };
}

const PRESETS: DateRangePreset[] = ["today", "week", "month", "custom"];

export function DateRangePicker({
  value,
  onChange,
}: {
  value: DateRangeValue;
  onChange: (value: DateRangeValue) => void;
}) {
  const { t } = useI18n();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        value={value.preset}
        onValueChange={(preset) => onChange({ ...value, preset: preset as DateRangePreset })}
      >
        <SelectTrigger className="w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PRESETS.map((preset) => (
            <SelectItem key={preset} value={preset}>
              {t(`dateRange.${preset}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {value.preset === "custom" && (
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={value.from}
            max={value.to}
            aria-label={t("dateRange.from")}
            onChange={(e) => onChange({ ...value, from: e.target.value })}
            className="w-[9.5rem]"
          />
          <span className="text-sm text-muted-foreground">{t("dateRange.to")}</span>
          <Input
            type="date"
            value={value.to}
            min={value.from}
            aria-label={t("dateRange.to")}
            onChange={(e) => onChange({ ...value, to: e.target.value })}
            className="w-[9.5rem]"
          />
        </div>
      )}
    </div>
  );
}

// Query params to send to the reports/analytics API for the given range.
export function dateRangeSearchParams(value: DateRangeValue): URLSearchParams {
  const params = new URLSearchParams({ preset: value.preset });
  if (value.preset === "custom") {
    params.set("from", value.from);
    params.set("to", value.to);
  }
  return params;
}
