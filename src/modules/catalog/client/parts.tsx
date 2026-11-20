import { useFormat } from "@/app/lib/format";
import { Badge } from "@/app/ui";
import { MOVEMENT_REASON_LABELS, stockLevel, type MovementReason, type Product } from "../shared/schema";

/** Small pieces shared by the catalog screens and widgets. */

/** Parses "2,5", "-3" or "−3" into a number; null when empty or not a number. */
export function parseDecimal(text: string): number | null {
  const normalized = text.trim().replace(/\s/gu, "").replace("−", "-").replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/u.test(normalized)) return null;
  return Number(normalized);
}

const levelTone = { ok: "success", low: "warning", out: "danger" } as const;
const levelLabel = { ok: "In stock", low: "Low", out: "Out" } as const;

/** "42 pcs  In stock" / "6 pcs  Low" / "0 pcs  Out" / "Not tracked". */
export function StockBadge({ product, compact }: { product: Pick<Product, "trackStock" | "stockOnHand" | "reorderPoint" | "unit">; compact?: boolean }) {
  const format = useFormat();
  const level = stockLevel(product);
  if (level === "untracked") return <Badge>Not tracked</Badge>;
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap">
      {compact ? null : (
        <span className="tabular">
          {format.number(product.stockOnHand)} {product.unit}
        </span>
      )}
      <Badge tone={levelTone[level]}>{levelLabel[level]}</Badge>
    </span>
  );
}

const reasonTone = { receipt: "success", sale: "info", return: "brand", adjustment: "warning", count: "neutral" } as const;

export function ReasonBadge({ reason }: { reason: MovementReason }) {
  return <Badge tone={reasonTone[reason]}>{MOVEMENT_REASON_LABELS[reason]}</Badge>;
}

/** +5 pcs in green, −2 pcs in red. */
export function SignedQuantity({ quantity, unit }: { quantity: number; unit: string }) {
  const format = useFormat();
  return (
    <span className={`tabular font-medium whitespace-nowrap ${quantity > 0 ? "text-success" : "text-destructive"}`}>
      {quantity > 0 ? "+" : "−"}
      {format.number(Math.abs(quantity))} {unit}
    </span>
  );
}

/** Moved to the UI kit; re-exported so existing imports keep working. */
export { CheckboxField } from "@/app/ui";
