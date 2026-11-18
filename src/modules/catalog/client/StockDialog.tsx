import { useState } from "react";
import { fieldError } from "@/app/lib/api";
import { useFormat } from "@/app/lib/format";
import { Button, Dialog, Field, FormError, Input, useToast } from "@/app/ui";
import { roundQuantity, type MovementInput, type Product } from "../shared/schema";
import { useRecordMovement } from "./api";
import { parseDecimal } from "./parts";

export type StockAction = "receive" | "adjust" | "count";

const titles: Record<StockAction, string> = { receive: "Receive stock", adjust: "Adjust stock", count: "Count stock" };

/**
 * Receive (supplier delivery or customer return), Adjust (signed change) or
 * Count (enter what is on the shelf; the server records the difference).
 */
export function StockDialog({ product, action, onClose }: { product: Product; action: StockAction | null; onClose: () => void }) {
  return action ? <StockDialogBody key={action} product={product} action={action} onClose={onClose} /> : null;
}

function StockDialogBody({ product, action, onClose }: { product: Product; action: StockAction; onClose: () => void }) {
  const format = useFormat();
  const toast = useToast();
  const record = useRecordMovement(product.id);
  const [reason, setReason] = useState<"receipt" | "return">("receipt");
  const [text, setText] = useState("");
  const [note, setNote] = useState("");
  const [localError, setLocalError] = useState<string>();
  const value = parseDecimal(text);
  const qty = (n: number) => `${format.number(n)} ${product.unit}`;

  const after = value === null ? null : action === "count" ? value : roundQuantity(product.stockOnHand + value);
  const delta = after === null ? null : roundQuantity(after - product.stockOnHand);

  const submit = () => {
    if (value === null) return setLocalError("Enter a number, e.g. 5 or 2.5.");
    if (action === "receive" && value <= 0) return setLocalError("Enter a quantity above 0.");
    if (action === "adjust" && value === 0) return setLocalError("Enter a change other than 0, e.g. -2.");
    if (action === "count" && value < 0) return setLocalError("A count cannot be below 0.");
    setLocalError(undefined);
    const input: MovementInput = action === "count" ? { reason: "count", countedQuantity: value, note } : { reason: action === "receive" ? reason : "adjustment", quantity: value, note };
    record.mutate(input, {
      onSuccess: (result) => {
        toast(result.movement ? `Stock is now ${qty(result.product.stockOnHand)}.` : "Count matches the stock on hand. Nothing changed.");
        onClose();
      },
    });
  };

  const quantityLabel = action === "count" ? "Counted quantity" : action === "adjust" ? "Change" : "Quantity received";
  const quantityHint = action === "adjust" ? "Negative removes stock, e.g. -2 for damaged goods." : action === "count" ? "What is physically on hand now." : undefined;

  return (
    <Dialog
      open
      onClose={onClose}
      title={titles[action]}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" loading={record.isPending} onClick={submit}>
            {action === "count" ? "Save count" : action === "adjust" ? "Save adjustment" : "Add to stock"}
          </Button>
        </>
      }
    >
      <form
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <p className="text-sm text-ink-soft">
          <span className="font-medium text-ink">{product.name}</span> · on hand <span className="tabular">{qty(product.stockOnHand)}</span>
        </p>
        {action === "receive" ? (
          <fieldset className="grid gap-2">
            <legend className="mb-1.5 text-sm font-medium">From</legend>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Where the stock comes from">
              {(
                [
                  ["receipt", "Supplier delivery"],
                  ["return", "Customer return"],
                ] as const
              ).map(([id, label]) => (
                <button key={id} type="button" role="radio" aria-checked={reason === id} onClick={() => setReason(id)} className={`h-9 rounded-full border px-3 text-sm ${reason === id ? "border-brand bg-brand-soft text-brand" : "border-line text-ink-soft hover:border-line-strong"}`}>
                  {label}
                </button>
              ))}
            </div>
          </fieldset>
        ) : null}
        <Field label={`${quantityLabel} (${product.unit})`} hint={quantityHint} error={localError ?? fieldError(record.error, action === "count" ? "countedQuantity" : "quantity")}>
          {(props) => <Input {...props} autoFocus inputMode="decimal" className="tabular text-right" value={text} onChange={(event) => setText(event.target.value)} placeholder={action === "adjust" ? "-2" : "0"} />}
        </Field>
        <Field label="Note" hint={action === "receive" ? "Supplier, delivery note or order number." : "Why the stock changed."} error={fieldError(record.error, "note")}>
          {(props) => <Input {...props} value={note} maxLength={500} onChange={(event) => setNote(event.target.value)} />}
        </Field>
        {after !== null && delta !== null ? (
          <p className="rounded-control bg-sunken px-3 py-2 text-sm" aria-live="polite">
            Stock after: <span className="tabular font-semibold">{qty(after)}</span>
            {action === "count" ? <span className="text-muted"> · difference {delta > 0 ? "+" : delta < 0 ? "−" : ""}{format.number(Math.abs(delta))}</span> : null}
          </p>
        ) : null}
        <FormError error={record.error} />
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}
