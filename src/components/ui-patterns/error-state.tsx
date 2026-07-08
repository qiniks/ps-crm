import { IconAlertTriangle } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";

type ErrorStateProps =
  | { message: string; onRetry?: undefined; retryLabel?: string }
  | { message: string; onRetry: () => void; retryLabel: string };

export function ErrorState({ message, onRetry, retryLabel }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-destructive/40 bg-destructive/5 p-10 text-center text-destructive">
      <IconAlertTriangle className="h-8 w-8" />
      <p>{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          {retryLabel}
        </Button>
      )}
    </div>
  );
}
