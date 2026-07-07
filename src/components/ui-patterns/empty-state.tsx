import type { ReactNode } from "react";

export function EmptyState({
  icon,
  message,
  action,
}: {
  icon: ReactNode;
  message: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
      <div className="text-muted-foreground/60">{icon}</div>
      <p>{message}</p>
      {action}
    </div>
  );
}
