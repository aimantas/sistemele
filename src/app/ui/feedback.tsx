import { AlertCircle, Inbox, Loader2 } from "lucide-react";
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { errorMessage } from "../lib/api";
import { Alert, AlertDescription } from "./alert";

export { Badge } from "./badge";

export function Spinner({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 py-8 text-muted-foreground" role="status">
      <Loader2 className="size-4 animate-spin" aria-hidden />
      <span className="text-sm">{label}…</span>
    </div>
  );
}

/** shadcn/ui "empty" pattern: icon, title, one sentence on what to do, one action. */
export function EmptyState({ title, description, action, icon }: { title: string; description?: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div data-slot="empty" className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-6 py-12 text-center text-balance">
      <div className="mb-1 flex size-10 items-center justify-center rounded-lg bg-muted text-foreground [&_svg]:size-5">{icon ?? <Inbox />}</div>
      <p className="text-base font-medium tracking-tight">{title}</p>
      {description ? <p className="max-w-sm text-sm text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ error, retry }: { error: unknown; retry?: () => void }) {
  return (
    <Alert variant="destructive">
      <AlertCircle />
      <AlertDescription>
        <p>{errorMessage(error)}</p>
        {retry ? (
          <button type="button" className="font-medium underline underline-offset-4" onClick={retry}>
            Try again
          </button>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}

export function FormError({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <Alert variant="destructive" className="py-2.5">
      <AlertCircle />
      <AlertDescription>{errorMessage(error)}</AlertDescription>
    </Alert>
  );
}

interface ToastItem {
  id: number;
  message: string;
  tone: "success" | "danger";
}

const ToastContext = createContext<(message: string, tone?: ToastItem["tone"]) => void>(() => undefined);

/** `const toast = useToast(); toast("Saved")`. */
export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const push = useCallback((message: string, tone: ToastItem["tone"] = "success") => {
    const id = Date.now() + Math.random();
    setItems((current) => [...current, { id, message, tone }]);
    setTimeout(() => setItems((current) => current.filter((item) => item.id !== id)), 4000);
  }, []);
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4" aria-live="polite">
        {items.map((item) => (
          <div
            key={item.id}
            className={cn(
              "pointer-events-auto animate-in rounded-lg border px-4 py-2.5 text-sm font-medium shadow-lg fade-in-0 slide-in-from-bottom-2",
              item.tone === "success" ? "border-transparent bg-foreground text-background" : "border-transparent bg-destructive text-white",
            )}
          >
            {item.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
