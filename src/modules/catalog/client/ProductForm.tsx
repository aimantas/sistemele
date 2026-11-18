import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api, fieldError } from "@/app/lib/api";
import { Button, Dialog, Field, FormError, Input, MoneyInput, Select, Textarea } from "@/app/ui";
import type { Product, ProductInput, ProductKind } from "../shared/schema";
import { useCreateProduct } from "./api";
import { CheckboxField, parseDecimal } from "./parts";

/** Form state: numbers the user types stay text until submit. */
export interface ProductFormState {
  name: string;
  sku: string;
  kind: ProductKind;
  unit: string;
  priceCents: number | null;
  costCents: number | null;
  /** VAT in percent, e.g. "21". Empty on a new product means the business rate. */
  vat: string;
  trackStock: boolean;
  reorderPoint: string;
  isPublic: boolean;
  description: string;
  imageUrl: string;
}

export const emptyProductForm: ProductFormState = { name: "", sku: "", kind: "product", unit: "pcs", priceCents: null, costCents: null, vat: "", trackStock: true, reorderPoint: "0", isPublic: false, description: "", imageUrl: "" };

export function productToForm(product: Product): ProductFormState {
  return {
    name: product.name,
    sku: product.sku,
    kind: product.kind,
    unit: product.unit,
    priceCents: product.priceCents,
    costCents: product.costCents,
    vat: String(product.vatRateBps / 100),
    trackStock: product.trackStock,
    reorderPoint: String(product.reorderPoint),
    isPublic: product.isPublic,
    description: product.description,
    imageUrl: product.imageUrl,
  };
}

/** Converts the form to API input, or returns field messages for numbers that do not parse. */
export function formToInput(form: ProductFormState): { input: ProductInput; errors: null } | { input: null; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const vat = form.vat.trim() === "" ? undefined : parseDecimal(form.vat);
  if (vat === null) errors.vatRateBps = "Enter VAT as a percentage, e.g. 21.";
  const reorderPoint = form.reorderPoint.trim() === "" ? 0 : parseDecimal(form.reorderPoint);
  if (reorderPoint === null) errors.reorderPoint = "Enter a number, e.g. 10.";
  if (Object.keys(errors).length) return { input: null, errors };
  return {
    input: {
      name: form.name,
      sku: form.sku,
      kind: form.kind,
      unit: form.unit,
      priceCents: form.priceCents,
      costCents: form.costCents,
      vatRateBps: vat === undefined || vat === null ? undefined : Math.round(vat * 100),
      trackStock: form.trackStock,
      reorderPoint: reorderPoint ?? 0,
      isPublic: form.isPublic,
      description: form.description,
      imageUrl: form.imageUrl,
    },
    errors: null,
  };
}

/** Business default VAT, shown as a placeholder on new products. */
export function useDefaultVatPercent(): string {
  const business = useQuery({ queryKey: ["settings", "business"], queryFn: () => api.get<{ business: { defaultVatRateBps: number } }>("/api/settings/business"), staleTime: 300_000 });
  return business.data ? String(business.data.business.defaultVatRateBps / 100) : "";
}

type Errors = (field: string) => string | undefined;

/** Name, SKU, type, unit, price, VAT. Used by the New product dialog and the edit form. */
export function ProductBasicFields({ form, set, errors, vatPlaceholder }: { form: ProductFormState; set: (patch: Partial<ProductFormState>) => void; errors: Errors; vatPlaceholder?: string }) {
  return (
    <>
      <Field label="Name" error={errors("name")} className="sm:col-span-2">
        {(props) => <Input {...props} required value={form.name} onChange={(event) => set({ name: event.target.value })} placeholder="Galvanised garden gate 1 m" />}
      </Field>
      <Field label="SKU" hint="Your product code. Must be unique." error={errors("sku")}>
        {(props) => <Input {...props} required value={form.sku} onChange={(event) => set({ sku: event.target.value })} placeholder="GATE-1000" autoCapitalize="characters" />}
      </Field>
      <Field label="Type" error={errors("kind")}>
        {(props) => (
          <Select {...props} value={form.kind} onChange={(event) => set({ kind: event.target.value as ProductKind })}>
            <option value="product">Product</option>
            <option value="service">Service</option>
          </Select>
        )}
      </Field>
      <Field label="Price per unit (net)" hint="Leave empty for price on request." error={errors("priceCents")}>
        {(props) => <MoneyInput {...props} value={form.priceCents} onValueChange={(priceCents) => set({ priceCents })} placeholder="0.00" />}
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Unit" error={errors("unit")}>
          {(props) => <Input {...props} value={form.unit} onChange={(event) => set({ unit: event.target.value })} placeholder="pcs" />}
        </Field>
        <Field label="VAT %" error={errors("vatRateBps")}>
          {(props) => <Input {...props} inputMode="decimal" className="tabular text-right" value={form.vat} onChange={(event) => set({ vat: event.target.value })} placeholder={vatPlaceholder} />}
        </Field>
      </div>
    </>
  );
}

/** Opens from the Products page (and ?new=1). Only the essentials; the rest is on the product page. */
export function NewProductDialog({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: (product: Product) => void }) {
  const create = useCreateProduct();
  const defaultVat = useDefaultVatPercent();
  const [form, setForm] = useState<ProductFormState>(emptyProductForm);
  const [trackTouched, setTrackTouched] = useState(false);
  const [localErrors, setLocalErrors] = useState<Record<string, string>>({});
  const errors: Errors = (field) => localErrors[field] ?? fieldError(create.error, field);
  const set = (patch: Partial<ProductFormState>) =>
    setForm((current) => {
      const next = { ...current, ...patch };
      // Services usually have no stock; follow the type until the user decides.
      if (patch.kind && !trackTouched) next.trackStock = patch.kind === "product";
      return next;
    });

  const submit = () => {
    const result = formToInput(form);
    setLocalErrors(result.errors ?? {});
    if (!result.input) return;
    create.mutate(result.input, {
      onSuccess: (product) => {
        onSaved(product);
        onClose();
        setForm(emptyProductForm);
        setTrackTouched(false);
      },
    });
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="New product"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" loading={create.isPending} onClick={submit}>
            Create product
          </Button>
        </>
      }
    >
      <form
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <ProductBasicFields form={form} set={set} errors={errors} vatPlaceholder={defaultVat} />
        <div className="sm:col-span-2">
          <CheckboxField
            label="Track stock"
            hint="Count what is on hand. Invoices deduct it automatically."
            checked={form.trackStock}
            onChange={(trackStock) => {
              setTrackTouched(true);
              set({ trackStock });
            }}
          />
        </div>
        <div className="sm:col-span-2">
          <FormError error={create.error} />
        </div>
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}

/** Cost, reorder point, website and description fields of the full edit form. */
export function ProductMoreFields({ form, set, errors }: { form: ProductFormState; set: (patch: Partial<ProductFormState>) => void; errors: Errors }) {
  return (
    <>
      <Field label="Cost per unit" hint="What you pay. Used for stock value." error={errors("costCents")}>
        {(props) => <MoneyInput {...props} value={form.costCents} onValueChange={(costCents) => set({ costCents })} placeholder="0.00" />}
      </Field>
      <Field label="Reorder point" hint="Flag as low stock at or below this quantity." error={errors("reorderPoint")}>
        {(props) => <Input {...props} inputMode="decimal" className="tabular text-right" disabled={!form.trackStock} value={form.reorderPoint} onChange={(event) => set({ reorderPoint: event.target.value })} />}
      </Field>
      <div className="grid gap-3 sm:col-span-2 sm:grid-cols-2">
        <CheckboxField label="Track stock" hint="Invoices deduct stock automatically." checked={form.trackStock} onChange={(trackStock) => set({ trackStock })} />
        <CheckboxField label="Show on the website" hint="Listed on /products with its price incl. VAT." checked={form.isPublic} onChange={(isPublic) => set({ isPublic })} />
      </div>
      <Field label="Description" hint="Shown on the website. Separate paragraphs with an empty line." error={errors("description")} className="sm:col-span-2">
        {(props) => <Textarea {...props} rows={5} value={form.description} onChange={(event) => set({ description: event.target.value })} />}
      </Field>
      <Field label="Image URL" hint="An https:// address or a path on this site." error={errors("imageUrl")} className="sm:col-span-2">
        {(props) => <Input {...props} inputMode="url" autoComplete="off" value={form.imageUrl} onChange={(event) => set({ imageUrl: event.target.value })} placeholder="https://" />}
      </Field>
    </>
  );
}
