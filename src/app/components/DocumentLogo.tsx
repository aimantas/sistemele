import { useBrandInfo } from "../lib/brand";

/** The business logo for quote and invoice previews; renders nothing until a logo is set. */
export function DocumentLogo({ className = "mb-6 h-10" }: { className?: string }) {
  const brand = useBrandInfo();
  if (!brand?.logoUrl) return null;
  return <img src={brand.logoUrl} alt={brand.name} className={`${className} w-auto max-w-[240px]`} />;
}
