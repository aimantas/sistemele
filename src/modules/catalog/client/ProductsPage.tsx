import { Globe, Package, Plus, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { useFormat } from "@/app/lib/format";
import { Badge, Button, EmptyState, ErrorState, Input, PageHeader, Select, Spinner, Table, Td, Th, Tr } from "@/app/ui";
import { useProducts, type ProductListParams } from "./api";
import { StockBadge } from "./parts";
import { NewProductDialog } from "./ProductForm";

const PAGE_SIZE = 50;

export default function ProductsPage() {
  const format = useFormat();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [term, setTerm] = useState(params.get("q") ?? "");
  const [creating, setCreating] = useState(params.get("new") === "1");
  const q = params.get("q") ?? "";
  const status = params.get("status") === "archived" ? "archived" : "active";
  const kind = (["product", "service"] as const).find((value) => value === params.get("kind"));
  const lowStock = params.get("lowStock") === "1";
  const offset = Number(params.get("offset") ?? 0) || 0;
  const query: ProductListParams = { q: q || undefined, status, kind, lowStock: lowStock ? 1 : undefined, limit: PAGE_SIZE, offset };
  const products = useProducts(query);
  const filtered = Boolean(q || kind || lowStock || status === "archived");

  const setParam = (key: string, value: string | null) =>
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (value) next.set(key, value);
      else next.delete(key);
      next.delete("offset");
      next.delete("new");
      return next;
    });

  useEffect(() => {
    const timer = setTimeout(() => {
      if (term !== q) setParam("q", term || null);
    }, 250);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- setParam is recreated each render; only the text matters
  }, [term, q]);

  const total = products.data?.total ?? 0;
  return (
    <div>
      <PageHeader
        title="Products"
        description="Products and services with prices and stock. Pick them on quotes and invoices."
        actions={
          <Button variant="default" icon={<Plus />} onClick={() => setCreating(true)}>
            New product
          </Button>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input aria-label="Search products" placeholder="Search name or SKU" className="pl-9" value={term} onChange={(event) => setTerm(event.target.value)} />
        </div>
        <Select aria-label="Status" className="w-auto" value={status} onChange={(event) => setParam("status", event.target.value === "archived" ? "archived" : null)}>
          <option value="active">Active</option>
          <option value="archived">Archived</option>
        </Select>
        <Select aria-label="Type" className="w-auto" value={kind ?? ""} onChange={(event) => setParam("kind", event.target.value || null)}>
          <option value="">Products and services</option>
          <option value="product">Products</option>
          <option value="service">Services</option>
        </Select>
        <button
          type="button"
          aria-pressed={lowStock}
          onClick={() => setParam("lowStock", lowStock ? null : "1")}
          className={`h-10 rounded-md border px-3 text-sm font-medium ${lowStock ? "border-primary bg-primary/10 text-primary" : "border-input bg-card text-foreground/80 hover:bg-muted"}`}
        >
          Low stock only
        </button>
        <p className="ml-auto text-sm text-muted-foreground">{products.data ? `${total} item${total === 1 ? "" : "s"}` : null}</p>
      </div>

      {products.error ? <ErrorState error={products.error} retry={() => products.refetch()} /> : null}
      {products.isLoading ? <Spinner /> : null}
      {products.data && products.data.items.length === 0 ? (
        <EmptyState
          icon={<Package />}
          title={lowStock && !q ? "Nothing is low on stock" : filtered ? "No products match" : "No products yet"}
          description={lowStock && !q ? "Every tracked product is above its reorder point." : filtered ? "Try another search or filter." : "Add what you sell. Products then appear on quotes, invoices and, if you choose, the website."}
          action={
            filtered ? null : (
              <Button variant="default" icon={<Plus />} onClick={() => setCreating(true)}>
                New product
              </Button>
            )
          }
        />
      ) : null}
      {products.data && products.data.items.length > 0 ? (
        <>
          <Table>
            <thead>
              <tr>
                <Th className="hidden sm:table-cell">SKU</Th>
                <Th>Name</Th>
                <Th align="right">Price (net)</Th>
                <Th>Stock</Th>
                <Th className="hidden md:table-cell">Website</Th>
              </tr>
            </thead>
            <tbody>
              {products.data.items.map((product) => (
                <Tr key={product.id}>
                  <Td className="hidden font-mono text-xs whitespace-nowrap text-foreground/80 sm:table-cell">{product.sku}</Td>
                  <Td>
                    <Link to={`/app/catalog/products/${product.id}`} className="font-medium text-foreground hover:text-primary hover:underline">
                      {product.name}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      <span className="sm:hidden">{product.sku} · </span>
                      {product.kind === "service" ? "Service" : "Product"}
                      {product.status === "archived" ? " · archived" : ""}
                    </p>
                  </Td>
                  <Td align="right">
                    {product.priceCents === null ? <span className="text-muted-foreground">On request</span> : format.money(product.priceCents)}
                    <p className="text-xs text-muted-foreground">/ {product.unit}</p>
                  </Td>
                  <Td>
                    <StockBadge product={product} />
                  </Td>
                  <Td className="hidden md:table-cell">
                    {product.isPublic ? (
                      <Badge tone="brand">
                        <Globe className="mr-1 size-3" aria-hidden />
                        Listed
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
          {total > PAGE_SIZE ? (
            <div className="mt-4 flex items-center justify-end gap-2">
              <Button variant="outline" size="sm" disabled={offset === 0} onClick={() => setParams((p) => (p.set("offset", String(Math.max(0, offset - PAGE_SIZE))), p))}>
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total}
              </span>
              <Button variant="outline" size="sm" disabled={offset + PAGE_SIZE >= total} onClick={() => setParams((p) => (p.set("offset", String(offset + PAGE_SIZE)), p))}>
                Next
              </Button>
            </div>
          ) : null}
        </>
      ) : null}
      <NewProductDialog open={creating} onClose={() => setCreating(false)} onSaved={(product) => navigate(`/app/catalog/products/${product.id}`)} />
    </div>
  );
}
