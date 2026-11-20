import { Link } from "react-router";
import { useFormat } from "@/app/lib/format";
import { ErrorState, Spinner } from "@/app/ui";
import { MOVEMENT_REASON_LABELS } from "../shared/schema";
import { useMovements, useProducts } from "./api";
import { SignedQuantity, StockBadge } from "./parts";

/** Dashboard cards. Keep each one small: a few lines and a link to the full screen. */

export function LowStockWidget() {
  const format = useFormat();
  const products = useProducts({ lowStock: 1, limit: 8 });
  if (products.error) return <ErrorState error={products.error} retry={() => products.refetch()} />;
  if (!products.data) return <Spinner />;
  if (products.data.items.length === 0) return <p className="text-sm text-muted-foreground">Nothing is at or below its reorder point.</p>;
  return (
    <div className="grid gap-2">
      <ul className="grid gap-1">
        {products.data.items.map((product) => (
          <li key={product.id}>
            <Link to={`/app/catalog/products/${product.id}`} className="flex items-center justify-between gap-3 rounded-md px-1 py-1.5 hover:bg-background">
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{product.name}</span>
                <span className="block text-xs text-muted-foreground">
                  <span className="tabular">
                    {format.number(product.stockOnHand)} / {format.number(product.reorderPoint)} {product.unit}
                  </span>{" "}
                  on hand / reorder point
                </span>
              </span>
              <StockBadge product={product} compact />
            </Link>
          </li>
        ))}
      </ul>
      {products.data.total > products.data.items.length ? (
        <Link to="/app/catalog/products?lowStock=1" className="text-sm text-primary hover:underline">
          All {products.data.total} low-stock products
        </Link>
      ) : null}
    </div>
  );
}

export function RecentMovementsWidget() {
  const format = useFormat();
  const movements = useMovements({ limit: 10 });
  if (movements.error) return <ErrorState error={movements.error} retry={() => movements.refetch()} />;
  if (!movements.data) return <Spinner />;
  if (movements.data.length === 0) return <p className="text-sm text-muted-foreground">No stock movements yet. Receive stock on a product page.</p>;
  return (
    <ul className="grid gap-1">
      {movements.data.map((movement) => (
        <li key={movement.id}>
          <Link to={`/app/catalog/products/${movement.productId}`} className="flex items-center justify-between gap-3 rounded-md px-1 py-1.5 hover:bg-background">
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">{movement.productName}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {MOVEMENT_REASON_LABELS[movement.reason]} · {format.relative(movement.createdAt)}
              </span>
            </span>
            <SignedQuantity quantity={movement.quantity} unit={movement.unit} />
          </Link>
        </li>
      ))}
    </ul>
  );
}
