import { useId, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Label } from "./label";

export { Input } from "./input";
export { Textarea } from "./textarea";
export { NativeSelect as Select } from "./native-select";

/** Native checkbox with a label and an optional hint, in a bordered row. */
export function CheckboxField({ label, hint, checked, onChange, disabled }: { label: string; hint?: ReactNode; checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean }) {
  return (
    <label className="flex items-start gap-3 rounded-md border px-3 py-2.5 transition-colors hover:bg-accent/60 has-[input:disabled]:opacity-60">
      <input type="checkbox" className="mt-0.5 size-4 shrink-0 accent-primary" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
      <span className="grid gap-0.5">
        <span className="text-sm font-medium">{label}</span>
        {hint ? <span className="text-sm text-muted-foreground">{hint}</span> : null}
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
    <div data-slot="field" className={cn("grid gap-2", className)}>
      <Label htmlFor={id}>{label}</Label>
      {children({ id, "aria-invalid": error ? true : undefined, "aria-describedby": describedBy })}
      {error ? (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-sm text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
