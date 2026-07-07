import { IconAlertTriangle } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";

export function ErrorState({
  message,
  onRetry,
  retryLabel,
}: {
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-destructive/40 bg-destructive/5 p-10 text-center text-destructive">
      <IconAlertTriangle className="h-8 w-8" />
      <p>{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          {retryLabel ?? "Retry"}
        </Button>
      )}
    </div>
  );
}
