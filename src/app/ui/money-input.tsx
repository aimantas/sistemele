import { useState, type InputHTMLAttributes } from "react";
import { centsToInput, parseMoneyInput } from "@/shared/money";
import { Input } from "./field";

/** Edits an amount in cents; shows "12.50", accepts "12,50". Emits null when empty or invalid. */
export function MoneyInput({ value, onValueChange, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> & { value: number | null; onValueChange: (cents: number | null) => void }) {
  const [text, setText] = useState(centsToInput(value));
  const [synced, setSynced] = useState(value);
  // Follow outside changes (e.g. a product picked) without fighting the user's typing.
  if (synced !== value) {
    setSynced(value);
    if (parseMoneyInput(text) !== value) setText(centsToInput(value));
  }
  return (
    <Input
      inputMode="decimal"
      autoComplete="off"
      {...props}
      className={`tabular text-right ${props.className ?? ""}`}
      value={text}
      onChange={(event) => {
        setText(event.target.value);
        onValueChange(event.target.value.trim() === "" ? null : parseMoneyInput(event.target.value));
      }}
    />
  );
}
