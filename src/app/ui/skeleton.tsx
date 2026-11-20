import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** shadcn/ui skeleton: a pulsing block that stands in for loading content. */
export function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="skeleton" className={cn("animate-pulse rounded-md bg-accent", className)} {...props} />;
}
