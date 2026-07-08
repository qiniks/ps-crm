"use client";

import { cn } from "@/lib/utils";

// Single-series chart primitives for the analytics page. One hue (the theme
// primary token, so light/dark both work), text in text tokens, hover tooltip
// on every mark, and only the peak value directly labeled.

export type Column = {
  key: string;
  // X-axis caption under the column; empty string renders no caption slot text.
  label: string;
  value: number;
  // Direct label shown above the peak column; defaults to String(value).
  valueLabel?: string;
  // Tooltip line shown on hover, e.g. "18:00–19:00 · 12 sessions".
  tooltip: string;
};

export function ColumnChart({ columns, className }: { columns: Column[]; className?: string }) {
  const max = Math.max(...columns.map((c) => c.value), 0);
  const peakIndex = max > 0 ? columns.findIndex((c) => c.value === max) : -1;

  return (
    <div className={className}>
      <div className="flex h-36 items-end gap-[2px] border-b border-border">
        {columns.map((c, i) => {
          // Clamped in JS, not with CSS max() — keeps tiny non-zero values visible.
          const pct = max > 0 && c.value > 0 ? Math.max((c.value / max) * 100, 2.5) : 0;
          return (
            <div key={c.key} className="group relative flex h-full flex-1 items-end justify-center">
              <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-popover px-2 py-1 text-xs text-popover-foreground shadow-md group-hover:block">
                {c.tooltip}
              </div>
              {i === peakIndex && (
                <span
                  className="pointer-events-none absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-medium text-muted-foreground"
                  style={{ bottom: `calc(${pct}% + 3px)` }}
                >
                  {c.valueLabel ?? c.value}
                </span>
              )}
              <div
                className={cn(
                  "w-full max-w-6 rounded-t-[4px]",
                  c.value > 0 ? "bg-primary group-hover:bg-primary/80" : "bg-muted"
                )}
                style={{ height: c.value > 0 ? `${pct}%` : "2px" }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex gap-[2px]">
        {columns.map((c) => (
          <div key={c.key} className="flex-1 text-center text-[10px] text-muted-foreground">
            {c.label}
          </div>
        ))}
      </div>
    </div>
  );
}

export type BarRow = {
  key: string;
  label: string;
  value: number;
  // Rendered at the bar tip, in a text token (e.g. "12 400 сом").
  valueLabel: string;
  // Optional second line under the row label, muted.
  sublabel?: string;
};

export function BarList({ rows, className }: { rows: BarRow[]; className?: string }) {
  const max = Math.max(...rows.map((r) => r.value), 0);

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {rows.map((r) => {
        const pct = max > 0 ? (r.value / max) * 100 : 0;
        return (
          <div key={r.key}>
            <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate text-foreground">{r.label}</span>
              <span className="shrink-0 font-medium text-foreground">{r.valueLabel}</span>
            </div>
            <div className="h-3 overflow-hidden rounded-r-[4px] bg-primary/10">
              <div
                className="h-full rounded-r-[4px] bg-primary"
                style={{ width: r.value > 0 ? `${Math.max(pct, 1.5)}%` : "0" }}
              />
            </div>
            {r.sublabel && <div className="mt-0.5 text-xs text-muted-foreground">{r.sublabel}</div>}
          </div>
        );
      })}
    </div>
  );
}
