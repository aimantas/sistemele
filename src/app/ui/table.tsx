import { clsx } from "clsx";
import type { HTMLAttributes, ReactNode, TdHTMLAttributes, ThHTMLAttributes } from "react";

/** Plain, accessible table. Wrap wide tables so they scroll on phones. */
export function Table({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={clsx("overflow-x-auto rounded-panel border border-line bg-surface", className)}>
      <table className="w-full border-collapse text-left text-sm">{children}</table>
    </div>
  );
}

export function Th({ className, align, ...props }: ThHTMLAttributes<HTMLTableCellElement> & { align?: "right" }) {
  return <th scope="col" className={clsx("border-b border-line bg-sunken/60 px-4 py-2.5 text-xs font-semibold tracking-wide text-muted uppercase", align === "right" && "text-right", className)} {...props} />;
}

export function Td({ className, align, ...props }: TdHTMLAttributes<HTMLTableCellElement> & { align?: "right" }) {
  return <td className={clsx("border-b border-line px-4 py-3 align-top", align === "right" && "text-right tabular whitespace-nowrap", className)} {...props} />;
}

export function Tr({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={clsx("last:[&>td]:border-b-0 hover:bg-paper/60", className)} {...props} />;
}
