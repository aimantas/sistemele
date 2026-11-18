import { ArrowLeftRight, X } from "lucide-react";
import { Link, useSearchParams } from "react-router";
import { useFormat } from "@/app/lib/format";
import { Button, EmptyState, ErrorState, PageHeader, Spinner, Table, Td, Th, Tr } from "@/app/ui";
import { useMovements } from "./api";
import { ReasonBadge, SignedQuantity } from "./parts";

const LIMIT = 200;

/** The stock ledger: every receipt, sale, return, adjustment and count, newest first. */
export default function MovementsPage() {
  const format = useFormat();
  const [params, setParams] = useSearchParams();
  const productId = params.get("productId") ?? undefined;
  const movements = useMovements({ productId, limit: LIMIT });
  const productName = movements.data?.[0]?.productName;

  return (
    <div>
      <PageHeader title="Stock movements" description="Deliveries, invoice sales, returns, adjustments and counts, newest first." />
      {productId ? (
        <div className="mb-4">
          <Button size="sm" variant="ghost" icon={<X />} onClick={() => setParams({})}>
            Product: {productName ?? productId}
          </Button>
        </div>
      ) : null}
      {movements.error ? <ErrorState error={movements.error} retry={() => movements.refetch()} /> : null}
      {movements.isLoading ? <Spinner /> : null}
      {movements.data && movements.data.length === 0 ? (
        <EmptyState icon={<ArrowLeftRight />} title="No stock movements yet" description="Receive stock on a product page. Issued invoices deduct stock here automatically." />
      ) : null}
      {movements.data && movements.data.length > 0 ? (
        <>
          <Table>
            <thead>
              <tr>
                <Th>When</Th>
                <Th>Product</Th>
                <Th className="hidden sm:table-cell">Reason</Th>
                <Th align="right">Quantity</Th>
                <Th className="hidden md:table-cell">Note</Th>
                <Th className="hidden lg:table-cell">By</Th>
              </tr>
            </thead>
            <tbody>
              {movements.data.map((movement) => (
                <Tr key={movement.id}>
                  <Td className="whitespace-nowrap text-ink-soft">
                    <time dateTime={movement.createdAt}>{format.dateTime(movement.createdAt)}</time>
                  </Td>
                  <Td>
                    <Link to={`/app/catalog/products/${movement.productId}`} className="font-medium text-ink hover:text-brand hover:underline">
                      {movement.productName}
                    </Link>
                    <p className="text-xs text-muted">
                      {movement.productSku}
                      <span className="sm:hidden"> · {movement.reason}</span>
                    </p>
                  </Td>
                  <Td className="hidden sm:table-cell">
                    <ReasonBadge reason={movement.reason} />
                  </Td>
                  <Td align="right">
                    <SignedQuantity quantity={movement.quantity} unit={movement.unit} />
                  </Td>
                  <Td className="hidden text-ink-soft md:table-cell">{movement.note || <span className="text-muted">—</span>}</Td>
                  <Td className="hidden text-ink-soft lg:table-cell">{movement.createdByName ?? <span className="text-muted">System</span>}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
          {movements.data.length === LIMIT ? <p className="mt-3 text-sm text-muted">Showing the latest {LIMIT} movements.</p> : null}
        </>
      ) : null}
    </div>
  );
}
