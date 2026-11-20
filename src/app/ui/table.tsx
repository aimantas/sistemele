import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

/** shadcn/ui table in a bordered card that scrolls sideways on phones. */
export function Table({ className, children, ...props }: ComponentProps<"table"> & { children: ReactNode }) {
  return (
    <div data-slot="table-container" className={cn("relative w-full overflow-x-auto rounded-xl border bg-card shadow-xs", className)}>
      <table data-slot="table" className="w-full caption-bottom text-left text-sm" {...props}>
        {children}
      </table>
    </div>
  );
}

export function TableHeader({ className, ...props }: ComponentProps<"thead">) {
  return <thead data-slot="table-header" className={cn("[&_tr]:border-b", className)} {...props} />;
}

export function TableBody({ className, ...props }: ComponentProps<"tbody">) {
  return <tbody data-slot="table-body" className={cn("[&_tr:last-child]:border-0", className)} {...props} />;
}

export function TableRow({ className, ...props }: ComponentProps<"tr">) {
  return <tr data-slot="table-row" className={cn("border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted", className)} {...props} />;
}

export function TableHead({ className, align, ...props }: ComponentProps<"th"> & { align?: "right" }) {
  return <th data-slot="table-head" scope="col" className={cn("h-10 border-b bg-muted/40 px-4 text-xs font-medium whitespace-nowrap text-muted-foreground", align === "right" && "text-right", className)} {...props} />;
}

export function TableCell({ className, align, ...props }: ComponentProps<"td"> & { align?: "right" }) {
  return <td data-slot="table-cell" className={cn("px-4 py-3 align-middle", align === "right" && "tabular text-right whitespace-nowrap", className)} {...props} />;
}

/** Short names used across the modules. */
export const Th = TableHead;
export const Td = TableCell;
export const Tr = TableRow;
