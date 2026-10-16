"use client";
// A confirmation before a destructive action, built on the native <dialog>: the browser traps
// focus inside it, makes the rest of the page inert and closes it on Escape. "Keep" is the first
// control, so that is where focus lands (the safe choice): pressing Enter by reflex deletes nothing.
import { useEffect, useId, useRef } from "react";
import Button from "@/components/Button";

export default function ConfirmDialog({ open, title, children, confirmLabel, cancelLabel = "Keep it", pending = false, onConfirm, onCancel }) {
  const ref = useRef(null);
  const titleId = useId(); // several dialogs can be on one page (a row each), so ids must differ

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="confirm-dialog"
      aria-labelledby={titleId}
      // Escape fires "cancel": hand control back to React instead of closing behind its back.
      onCancel={(event) => {
        event.preventDefault();
        if (!pending) onCancel();
      }}
    >
      <h2 id={titleId}>{title}</h2>
      <div className="confirm-dialog__body">{children}</div>
      <div className="confirm-dialog__actions">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={pending}>
          {cancelLabel}
        </Button>
        <Button type="button" variant="primary" className="btn--destructive" onClick={onConfirm} disabled={pending}>
          {pending ? "Working…" : confirmLabel}
        </Button>
      </div>
    </dialog>
  );
}
