import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** shadcn/ui label (native <label>; no Radix needed). */
export function Label({ className, ...props }: ComponentProps<"label">) {
  return <label data-slot="label" className={cn("flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:opacity-50 peer-disabled:opacity-50", className)} {...props} />;
}
