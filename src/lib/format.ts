// Shared formatting helpers. Money is stored as whole minor units (e.g. som).

export function formatMoney(amount: number): string {
  return new Intl.NumberFormat("ru-RU").format(amount);
}

// Milliseconds -> "H:MM:SS"
export function formatDuration(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${h}:${pad(m)}:${pad(s)}`;
}

// Compute session cost from elapsed time and hourly rate (billed per started minute).
export function computeCost(startedAt: Date, endedAt: Date, hourlyRate: number): number {
  const ms = endedAt.getTime() - startedAt.getTime();
  const hours = ms / 1000 / 60 / 60;
  return Math.round(hours * hourlyRate);
}
