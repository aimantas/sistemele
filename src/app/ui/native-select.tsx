import { ChevronDown } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const widthClass = /(^|\s)((?:[\w-]+:)*(?:w|min-w|max-w)-[^\s]+)/gu;

/**
 * shadcn/ui native select: a real <select> (keyboard, mobile pickers, forms)
 * with the input's look and a chevron. Width classes go to the wrapper.
 */
export function NativeSelect({ className, ...props }: ComponentProps<"select">) {
  const widths = className?.match(widthClass)?.join(" ") ?? "";
  const rest = className?.replace(widthClass, " ") ?? "";
  return (
    <div data-slot="native-select-wrapper" className={cn("relative w-full has-[select:disabled]:opacity-50", widths)}>
      <select
        data-slot="native-select"
        className={cn(
          "h-9 w-full min-w-0 appearance-none rounded-md border border-input bg-card py-1 pr-9 pl-3 text-base shadow-xs transition-[color,box-shadow] outline-none disabled:pointer-events-none disabled:cursor-not-allowed md:text-sm dark:bg-input/30",
          "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
          "aria-invalid:border-destructive aria-invalid:ring-destructive/20",
          rest,
        )}
        {...props}
      />
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
    </div>
  );
}
