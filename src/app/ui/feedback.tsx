import { clsx } from "clsx";
import { AlertTriangle, Inbox } from "lucide-react";
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { errorMessage } from "../lib/api";

type Tone = "neutral" | "brand" | "success" | "warning" | "danger" | "info";
const tones: Record<Tone, string> = {
  neutral: "bg-sunken text-ink-soft",
  brand: "bg-brand-soft text-brand",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  info: "bg-info-soft text-info",
};

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={clsx("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap", tones[tone], className)}>{children}</span>;
}

export function Spinner({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 py-8 text-muted" role="status">
      <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />
      <span className="text-sm">{label}…</span>
    </div>
  );
}

export function EmptyState({ title, description, action, icon }: { title: string; description?: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-panel border border-dashed border-line-strong px-6 py-12 text-center">
      <div className="text-muted [&_svg]:size-6">{icon ?? <Inbox />}</div>
      <p className="font-medium">{title}</p>
      {description ? <p className="max-w-sm text-sm text-muted">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ error, retry }: { error: unknown; retry?: () => void }) {
  return (
    <div className="flex items-start gap-3 rounded-panel border border-danger/30 bg-danger-soft px-4 py-3 text-danger" role="alert">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      <div className="text-sm">
        <p>{errorMessage(error)}</p>
        {retry ? (
          <button type="button" className="mt-1 font-medium underline" onClick={retry}>
            Try again
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function FormError({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <p className="rounded-control bg-danger-soft px-3 py-2 text-sm text-danger" role="alert">
      {errorMessage(error)}
    </p>
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
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4" aria-live="polite">
        {items.map((item) => (
          <div key={item.id} className={clsx("pointer-events-auto rounded-control px-4 py-2.5 text-sm font-medium shadow-lg", item.tone === "success" ? "bg-ink text-white" : "bg-danger text-white")}>
            {item.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
