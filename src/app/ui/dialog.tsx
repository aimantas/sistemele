import { clsx } from "clsx";
import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { IconButton } from "./button";

/**
 * Modal built on the native <dialog> element: focus trapping, Escape to close
 * and the backdrop come from the browser.
 */
export function Dialog({ open, onClose, title, children, footer, size = "md" }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; size?: "md" | "lg" }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
      className={clsx(
        "m-auto w-[calc(100%-2rem)] rounded-panel border border-line bg-surface p-0 text-ink shadow-2xl backdrop:bg-ink/40",
        size === "lg" ? "max-w-3xl" : "max-w-lg",
      )}
    >
      {open ? (
        <div className="flex max-h-[85vh] flex-col">
          <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-3">
            <h2 className="text-lg font-semibold">{title}</h2>
            <IconButton label="Close" onClick={onClose}>
              <X />
            </IconButton>
          </div>
          <div className="overflow-y-auto px-5 py-4">{children}</div>
          {footer ? <div className="flex justify-end gap-2 border-t border-line px-5 py-3">{footer}</div> : null}
        </div>
      ) : null}
    </dialog>
  );
}

/** Confirm before destructive actions. */
export function ConfirmDialog({ open, title, message, confirmLabel, onConfirm, onClose, loading }: { open: boolean; title: string; message: ReactNode; confirmLabel: string; onConfirm: () => void; onClose: () => void; loading?: boolean }) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <button type="button" className="h-10 rounded-control px-4 font-medium text-ink-soft hover:bg-sunken" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="h-10 rounded-control bg-danger px-4 font-medium text-white hover:bg-danger/90 disabled:opacity-50" onClick={onConfirm} disabled={loading}>
            {confirmLabel}
          </button>
        </>
      }
    >
      <div className="text-ink-soft">{message}</div>
    </Dialog>
  );
}
