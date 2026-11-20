import { cn } from "@/lib/utils";
import type { BrandInfo } from "@/shared/branding";

/**
 * The brand as the admin panel shows it: a wide logo on its own, or a square
 * mark (the uploaded one, or the default wheel) with the business name set
 * beside it in the UI font.
 */
export function BrandLockup({ brand, fallbackName = "Sistemėlė", size = "md", className }: { brand: BrandInfo | undefined; fallbackName?: string; size?: "md" | "lg"; className?: string }) {
  const name = brand?.name ?? fallbackName;
  if (brand?.logoUrl && !brand.logoMark) {
    return <img src={brand.logoUrl} alt={name} className={cn(size === "lg" ? "h-9" : "h-7", "w-auto max-w-[220px]", className)} />;
  }
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-2.5 font-semibold tracking-tight", size === "lg" ? "text-lg" : "text-[15px]", className)}>
      <img src={brand?.logoUrl ?? "/favicon.svg"} alt="" className={cn(size === "lg" ? "size-9" : "size-7", "shrink-0")} />
      <span className="truncate">{name}</span>
    </span>
  );
}
