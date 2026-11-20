import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogRoot, DialogTitle } from "./dialog";

/**
 * The app's dialog: a controlled shadcn Dialog with a title, a scrolling body
 * and an optional footer of actions. Use for create/edit forms; confirm
 * destructive actions with ConfirmDialog.
 */
export function Dialog({ open, onClose, title, description, children, footer, size = "md" }: { open: boolean; onClose: () => void; title: string; description?: string; children: ReactNode; footer?: ReactNode; size?: "md" | "lg" }) {
  return (
    <DialogRoot open={open} onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent className={cn(size === "lg" ? "sm:max-w-3xl" : "sm:max-w-lg")}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : <DialogDescription className="sr-only">{title}</DialogDescription>}
        </DialogHeader>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer ? <DialogFooter>{footer}</DialogFooter> : null}
      </DialogContent>
    </DialogRoot>
  );
}

/** Confirm before destructive actions: says what happens and what stays. */
export function ConfirmDialog({ open, title, message, confirmLabel, onConfirm, onClose, loading }: { open: boolean; title: string; message: ReactNode; confirmLabel: string; onConfirm: () => void; onClose: () => void; loading?: boolean }) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="destructive" loading={loading} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="text-foreground/80">{message}</div>
    </Dialog>
  );
}
