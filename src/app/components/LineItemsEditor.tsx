import { useQuery } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { useId, useState } from "react";
import { clientModules } from "@/modules/client";
import type { LineInput, ProductSummary } from "@/shared/lines";
import { documentTotals } from "@/shared/money";
import { api } from "../lib/api";
import { useFormat } from "../lib/format";
import { Button, IconButton, Input, MoneyInput } from "../ui";

const catalogEnabled = clientModules.some((module) => module.id === "catalog");

export function emptyLine(vatRateBps: number): LineInput {
  return { productId: null, description: "", quantity: 1, unit: "pcs", unitPriceCents: 0, vatRateBps, discountBps: 0 };
}

/**
 * Editable line items for quotes and invoices with a live totals preview.
 * When the catalog module is on, typing in Description suggests products.
 * The server recalculates every total; this preview is for the user only.
 */
export function LineItemsEditor({ lines, onChange, defaultVatRateBps, errors = {}, disabled }: { lines: LineInput[]; onChange: (lines: LineInput[]) => void; defaultVatRateBps: number; errors?: Record<string, string>; disabled?: boolean }) {
  const format = useFormat();
  const totals = documentTotals(lines.map((line) => ({ quantity: Number(line.quantity) || 0, unitPriceCents: line.unitPriceCents, vatRateBps: line.vatRateBps, discountBps: line.discountBps ?? 0 })));
  const update = (index: number, patch: Partial<LineInput>) => onChange(lines.map((line, i) => (i === index ? { ...line, ...patch } : line)));

  return (
    <div className="grid gap-3">
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/60 text-left text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              <th className="px-3 py-2">Description</th>
              <th className="w-24 px-3 py-2 text-right">Qty</th>
              <th className="w-20 px-3 py-2">Unit</th>
              <th className="w-32 px-3 py-2 text-right">Unit price</th>
              <th className="w-20 px-3 py-2 text-right">Disc. %</th>
              <th className="w-20 px-3 py-2 text-right">VAT %</th>
              <th className="w-28 px-3 py-2 text-right">Net</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {lines.map((line, index) => {
              const net = Math.round((Number(line.quantity) || 0) * line.unitPriceCents * (1 - (line.discountBps ?? 0) / 10_000));
              const error = (field: string) => errors[`lines.${index}.${field}`];
              return (
                <tr key={index} className="border-b border-border align-top last:border-0">
                  <td className="px-3 py-2">
                    <DescriptionCell disabled={disabled} value={line.description} invalid={Boolean(error("description"))} onChange={(description) => update(index, { description, productId: null })} onPick={(product) => update(index, { productId: product.id, description: product.name, unit: product.unit, unitPriceCents: product.priceCents ?? 0, vatRateBps: product.vatRateBps })} />
                    {line.productId ? <p className="mt-1 text-xs text-muted-foreground">From catalog</p> : null}
                    {error("description") ? <p className="mt-1 text-xs text-destructive">{error("description")}</p> : null}
                  </td>
                  <td className="px-3 py-2">
                    <Input aria-label="Quantity" disabled={disabled} inputMode="decimal" className="tabular text-right" value={String(line.quantity)} aria-invalid={error("quantity") ? true : undefined} onChange={(event) => update(index, { quantity: Number(event.target.value.replace(",", ".")) || (event.target.value as unknown as number) })} />
                  </td>
                  <td className="px-3 py-2">
                    <Input aria-label="Unit" disabled={disabled} value={line.unit ?? "pcs"} onChange={(event) => update(index, { unit: event.target.value })} />
                  </td>
                  <td className="px-3 py-2">
                    <MoneyInput aria-label="Unit price" disabled={disabled} value={line.unitPriceCents} onValueChange={(cents) => update(index, { unitPriceCents: cents ?? 0 })} />
                  </td>
                  <td className="px-3 py-2">
                    <Input aria-label="Discount percent" disabled={disabled} inputMode="decimal" className="tabular text-right" value={(line.discountBps ?? 0) / 100} onChange={(event) => update(index, { discountBps: Math.round(Number(event.target.value.replace(",", ".")) * 100) || 0 })} />
                  </td>
                  <td className="px-3 py-2">
                    <Input aria-label="VAT percent" disabled={disabled} inputMode="decimal" className="tabular text-right" value={line.vatRateBps / 100} onChange={(event) => update(index, { vatRateBps: Math.round(Number(event.target.value.replace(",", ".")) * 100) || 0 })} />
                  </td>
                  <td className="tabular px-3 py-4 text-right font-medium whitespace-nowrap">{format.money(net)}</td>
                  <td className="px-1 py-3">
                    {!disabled && lines.length > 1 ? (
                      <IconButton label="Remove line" onClick={() => onChange(lines.filter((_, i) => i !== index))}>
                        <Trash2 />
                      </IconButton>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {errors.lines ? <p className="text-sm text-destructive">{errors.lines}</p> : null}
      <div className="flex flex-wrap items-start justify-between gap-4">
        {!disabled ? (
          <Button variant="outline" size="sm" icon={<Plus />} onClick={() => onChange([...lines, emptyLine(defaultVatRateBps)])}>
            Add line
          </Button>
        ) : (
          <span />
        )}
        <dl className="tabular grid min-w-64 grid-cols-[1fr_auto] gap-x-6 gap-y-1 text-sm">
          <dt className="text-muted-foreground">Net</dt>
          <dd className="text-right">{format.money(totals.subtotalCents)}</dd>
          {totals.vatGroups.map((group) => (
            <div key={group.rateBps} className="contents">
              <dt className="text-muted-foreground">VAT {format.vat(group.rateBps)}</dt>
              <dd className="text-right">{format.money(group.vatCents)}</dd>
            </div>
          ))}
          <dt className="border-t border-border pt-1 font-semibold">Total</dt>
          <dd className="border-t border-border pt-1 text-right font-semibold">{format.money(totals.totalCents)}</dd>
        </dl>
      </div>
    </div>
  );
}

function DescriptionCell({ value, onChange, onPick, invalid, disabled }: { value: string; onChange: (value: string) => void; onPick: (product: ProductSummary) => void; invalid: boolean; disabled?: boolean }) {
  const listId = useId();
  const [focused, setFocused] = useState(false);
  const term = value.trim();
  const suggestions = useQuery({
    queryKey: ["catalog", "line-search", term],
    queryFn: () => api.get<{ items: ProductSummary[] }>(`/api/catalog/products?q=${encodeURIComponent(term)}&limit=6`),
    enabled: catalogEnabled && focused && term.length >= 2,
    staleTime: 30_000,
  });
  const format = useFormat();
  const items = suggestions.data?.items ?? [];
  return (
    <div className="relative">
      <Input aria-label="Description" disabled={disabled} value={value} aria-invalid={invalid || undefined} aria-autocomplete={catalogEnabled ? "list" : undefined} aria-controls={catalogEnabled ? listId : undefined} onFocus={() => setFocused(true)} onBlur={() => setTimeout(() => setFocused(false), 150)} onChange={(event) => onChange(event.target.value)} placeholder={catalogEnabled ? "Type to search products, or describe the line" : "Describe the line"} />
      {focused && items.length > 0 ? (
        <ul id={listId} role="listbox" className="absolute z-20 mt-1 w-full min-w-72 overflow-hidden rounded-md border border-border bg-card shadow-lg">
          {items.map((product) => (
            <li key={product.id} role="option" aria-selected={false}>
              <button type="button" className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-muted" onMouseDown={(event) => event.preventDefault()} onClick={() => (onPick(product), setFocused(false))}>
                <span className="min-w-0">
                  <span className="block truncate font-medium">{product.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {product.sku}
                    {product.trackStock ? ` · ${product.stockOnHand} ${product.unit} in stock` : ""}
                  </span>
                </span>
                <span className="tabular shrink-0 text-sm">{format.money(product.priceCents)}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
