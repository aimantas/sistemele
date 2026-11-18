import { Archive, ArchiveRestore, ArrowLeft, ExternalLink, PackageCheck, PackagePlus, SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router";
import { fieldError } from "@/app/lib/api";
import { useFormat } from "@/app/lib/format";
import { Badge, Button, buttonClass, Card, CardHeader, ConfirmDialog, ErrorState, FormError, PageHeader, Spinner, useToast } from "@/app/ui";
import type { Movement, Product } from "../shared/schema";
import { useProduct, useSetProductStatus, useUpdateProduct } from "./api";
import { ReasonBadge, SignedQuantity, StockBadge } from "./parts";
import { formToInput, ProductBasicFields, ProductMoreFields, productToForm, type ProductFormState } from "./ProductForm";
import { StockDialog, type StockAction } from "./StockDialog";

export default function ProductDetailPage() {
  const { id = "" } = useParams();
  const detail = useProduct(id);
  if (detail.isLoading) return <Spinner />;
  if (detail.error || !detail.data) return <ErrorState error={detail.error} retry={() => detail.refetch()} />;
  // Keyed by id: the form keeps unsaved edits while stock changes refresh the rest of the page.
  return <ProductScreen key={detail.data.product.id} product={detail.data.product} movements={detail.data.movements} />;
}

function ProductScreen({ product, movements }: { product: Product; movements: Movement[] }) {
  const setStatus = useSetProductStatus(product.id);
  const toast = useToast();
  const [archiving, setArchiving] = useState(false);
  const [stockAction, setStockAction] = useState<StockAction | null>(null);
  const archived = product.status === "archived";

  return (
    <div>
      <PageHeader
        back={
          <Link to="/app/catalog/products" className="inline-flex items-center gap-1 text-muted hover:text-ink">
            <ArrowLeft className="size-4" /> Products
          </Link>
        }
        title={
          <span className="flex flex-wrap items-center gap-2">
            {product.name}
            {archived ? <Badge>Archived</Badge> : null}
          </span>
        }
        description={`${product.sku} · ${product.kind === "service" ? "Service" : "Product"}`}
        actions={
          <>
            {product.isPublic && !archived ? (
              <a href={`/products/${product.slug}`} target="_blank" rel="noreferrer" className={buttonClass("ghost")}>
                <ExternalLink /> View on website
              </a>
            ) : null}
            {archived ? (
              <Button icon={<ArchiveRestore />} loading={setStatus.isPending} onClick={() => setStatus.mutate("restore", { onSuccess: () => toast("Product restored.") })}>
                Restore
              </Button>
            ) : (
              <Button variant="ghost" icon={<Archive />} onClick={() => setArchiving(true)}>
                Archive
              </Button>
            )}
          </>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <DetailsForm product={product} />
        <div className="grid content-start gap-6">
          <StockCard product={product} onAction={setStockAction} />
          {product.trackStock || movements.length ? <HistoryCard product={product} movements={movements} /> : null}
        </div>
      </div>
      <StockDialog product={product} action={stockAction} onClose={() => setStockAction(null)} />
      <ConfirmDialog
        open={archiving}
        title={`Archive ${product.name}?`}
        message="It disappears from product lists, the line editor and the website. Its stock history stays, and you can restore it later."
        confirmLabel="Archive product"
        loading={setStatus.isPending}
        onConfirm={() => setStatus.mutate("archive", { onSuccess: () => (setArchiving(false), toast("Product archived.")) })}
        onClose={() => setArchiving(false)}
      />
    </div>
  );
}

function DetailsForm({ product }: { product: Product }) {
  const update = useUpdateProduct(product.id);
  const toast = useToast();
  const [saved, setSaved] = useState<ProductFormState>(() => productToForm(product));
  const [form, setForm] = useState<ProductFormState>(saved);
  const [localErrors, setLocalErrors] = useState<Record<string, string>>({});
  const errors = (field: string) => localErrors[field] ?? fieldError(update.error, field);
  const set = (patch: Partial<ProductFormState>) => setForm((current) => ({ ...current, ...patch }));
  const dirty = JSON.stringify(form) !== JSON.stringify(saved);

  return (
    <Card>
      <CardHeader title="Details" />
      <form
        className="grid gap-4 p-5 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          const result = formToInput(form);
          setLocalErrors(result.errors ?? {});
          if (!result.input) return;
          update.mutate(result.input, {
            onSuccess: (next) => {
              const fresh = productToForm(next);
              setSaved(fresh);
              setForm(fresh);
              toast("Product saved.");
            },
          });
        }}
      >
        <ProductBasicFields form={form} set={set} errors={errors} />
        <ProductMoreFields form={form} set={set} errors={errors} />
        <div className="sm:col-span-2">
          <FormError error={update.error} />
        </div>
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <Button type="submit" variant="primary" loading={update.isPending} disabled={!dirty}>
            Save changes
          </Button>
          {dirty ? (
            <Button variant="ghost" onClick={() => (setForm(saved), setLocalErrors({}), update.reset())}>
              Discard
            </Button>
          ) : null}
        </div>
      </form>
    </Card>
  );
}

function StockCard({ product, onAction }: { product: Product; onAction: (action: StockAction) => void }) {
  const format = useFormat();
  if (!product.trackStock) {
    return (
      <Card>
        <CardHeader title="Stock" />
        <p className="px-5 py-4 text-sm text-muted">Stock is not tracked for this {product.kind}. Turn on “Track stock” in Details to count it and let invoices deduct it.</p>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader title="Stock" actions={<StockBadge product={product} compact />} />
      <div className="grid gap-4 p-5">
        <div className="flex items-baseline justify-between gap-3">
          <p>
            <span className="tabular text-3xl font-semibold tracking-tight">{format.number(product.stockOnHand)}</span> <span className="text-ink-soft">{product.unit} on hand</span>
          </p>
          <p className="text-right text-sm text-muted">
            Reorder at <span className="tabular">{format.number(product.reorderPoint)}</span>
          </p>
        </div>
        {product.costCents !== null ? <p className="text-sm text-muted">Value at cost: {format.money(Math.round(Math.max(product.stockOnHand, 0) * product.costCents))}</p> : null}
        <div className="grid grid-cols-3 gap-2">
          <Button size="sm" icon={<PackagePlus />} onClick={() => onAction("receive")}>
            Receive
          </Button>
          <Button size="sm" icon={<SlidersHorizontal />} onClick={() => onAction("adjust")}>
            Adjust
          </Button>
          <Button size="sm" icon={<PackageCheck />} onClick={() => onAction("count")}>
            Count
          </Button>
        </div>
      </div>
    </Card>
  );
}

function HistoryCard({ product, movements }: { product: Product; movements: Movement[] }) {
  const format = useFormat();
  return (
    <Card>
      <CardHeader
        title="Stock history"
        actions={
          movements.length ? (
            <Link to={`/app/catalog/movements?productId=${product.id}`} className="text-sm text-brand hover:underline">
              All
            </Link>
          ) : null
        }
      />
      {movements.length === 0 ? (
        <p className="px-5 py-4 text-sm text-muted">No movements yet. Receive stock to start the history; invoices add sales automatically.</p>
      ) : (
        <ol className="divide-y divide-line">
          {movements.map((movement) => (
            <li key={movement.id} className="grid gap-1 px-5 py-3">
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2">
                  <ReasonBadge reason={movement.reason} />
                  <SignedQuantity quantity={movement.quantity} unit={product.unit} />
                </span>
                {movement.balanceAfter !== undefined ? (
                  <span className="tabular text-sm text-muted" title="Stock after this movement">
                    → {format.number(movement.balanceAfter)}
                  </span>
                ) : null}
              </div>
              <p className="text-xs text-muted">
                <time dateTime={movement.createdAt}>{format.dateTime(movement.createdAt)}</time>
                {movement.createdByName ? ` · ${movement.createdByName}` : ""}
                {movement.note ? ` · ${movement.note}` : ""}
              </p>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
