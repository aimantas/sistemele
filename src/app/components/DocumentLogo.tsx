import { useBrandInfo } from "../lib/brand";
import { BrandLockup } from "./BrandLockup";

/** The business logo for quote and invoice previews; renders nothing until a logo is set. */
export function DocumentLogo({ className = "mb-6" }: { className?: string }) {
  const brand = useBrandInfo();
  if (!brand?.logoUrl) return null;
  return (
    <div className={className}>
      <BrandLockup brand={brand} size="lg" />
    </div>
  );
}
