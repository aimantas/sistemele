import { clsx } from "clsx";
import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";

const control =
  "rounded-control border border-line-strong bg-surface px-3 text-ink placeholder:text-muted/70 disabled:bg-sunken disabled:text-muted aria-[invalid=true]:border-danger";

/** Controls fill their container unless the caller sets a width (w-auto, w-24 …); both classes together would let CSS order decide. */
const width = (className?: string) => (className && /(^|\s)(\w+:)*w-/u.test(className) ? undefined : "w-full");

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={clsx(control, width(className), "h-10", className)} {...props} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={clsx(control, width(className), "min-h-24 py-2", className)} {...props} />;
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={clsx(control, width(className), "h-10 pr-8", className)} {...props}>
      {children}
    </select>
  );
}

/** Native checkbox with a label and an optional hint. */
export function CheckboxField({ label, hint, checked, onChange, disabled }: { label: string; hint?: ReactNode; checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean }) {
  return (
    <label className="flex items-start gap-3 rounded-control border border-line px-3 py-2.5 hover:border-line-strong">
      <input type="checkbox" className="mt-0.5 size-4 shrink-0 accent-brand" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
      <span className="grid gap-0.5">
        <span className="text-sm font-medium">{label}</span>
        {hint ? <span className="text-sm text-muted">{hint}</span> : null}
      </span>
    </label>
  );
}

export interface FieldProps {
  label: string;
  /** Server or client validation message. */
  error?: string;
  hint?: string;
  className?: string;
  children: (props: { id: string; "aria-invalid"?: boolean; "aria-describedby"?: string }) => ReactNode;
}

/** Label + control + hint/error, wired for screen readers. */
export function Field({ label, error, hint, className, children }: FieldProps) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className={clsx("grid gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      {children({ id, "aria-invalid": error ? true : undefined, "aria-describedby": describedBy })}
      {error ? (
        <p id={`${id}-error`} className="text-sm text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-sm text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
