import { Loader2 } from "lucide-react";

export function LoadingSpinner() {
  return (
    <div className="flex h-20 w-full items-center justify-center" role="status" aria-live="polite">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
      <span className="sr-only">Loading</span>
    </div>
  );
}

export function PageLoadingFallback() {
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center gap-4" role="status" aria-live="polite">
      <Loader2 className="h-12 w-12 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">Loading...</p>
    </div>
  );
}
