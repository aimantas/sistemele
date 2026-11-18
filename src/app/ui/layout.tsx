import { clsx } from "clsx";
import type { HTMLAttributes, ReactNode } from "react";

/** Page title row: one h1, optional description and actions. */
export function PageHeader({ title, description, actions, back }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; back?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {back ? <div className="mb-2 text-sm">{back}</div> : null}
        <h1 className="text-2xl font-semibold text-ink">{title}</h1>
        {description ? <p className="mt-1 max-w-2xl text-ink-soft">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={clsx("rounded-panel border border-line bg-surface", className)} {...props} />;
}

export function CardHeader({ title, actions, className }: { title: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <div className={clsx("flex items-center justify-between gap-3 border-b border-line px-5 py-3", className)}>
      <h2 className="text-base font-semibold">{title}</h2>
      {actions}
    </div>
  );
}

/** Label/value pairs, e.g. contact details. */
export function DetailList({ items }: { items: Array<{ label: string; value: ReactNode }> }) {
  return (
    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="text-xs font-medium tracking-wide text-muted uppercase">{item.label}</dt>
          <dd className="mt-0.5 break-words">{item.value || <span className="text-muted">—</span>}</dd>
        </div>
      ))}
    </dl>
  );
}
