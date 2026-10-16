"use client";
// Changes an order's status through PATCH /api/admin/orders/:id. The browser is not trusted to
// decide anything: the handler checks the admin session, the same-origin rule and the status
// value, and the page then re-reads the real order (router.refresh), so what is shown after a
// save is what the server stored, not what this form assumed.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/Button";
import ConfirmDialog from "./ConfirmDialog";
import { ORDER_STATUSES, STATUS_LABELS } from "@/lib/order-status";

export default function OrderStatusForm({ orderId, current }) {
  const router = useRouter();
  const [choice, setChoice] = useState(current);
  const [pending, setPending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState(null); // { type: "success" | "error", text }

  // After router.refresh() the server tells us the real status; follow it.
  useEffect(() => setChoice(current), [current]);

  async function save(status) {
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/orders/${encodeURIComponent(orderId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage({
          type: "error",
          text:
            response.status === 401 || response.status === 403
              ? "Your admin session has ended. Sign in again, then retry."
              : data.error || `The status was not changed (error ${response.status}).`,
        });
        return;
      }
      setMessage({ type: "success", text: `Status set to “${STATUS_LABELS[status]}”.` });
      router.refresh();
    } catch {
      setMessage({ type: "error", text: "Could not reach the server. Check your connection and try again." });
    } finally {
      setPending(false);
      setConfirming(false);
    }
  }

  function onSubmit(event) {
    event.preventDefault();
    if (choice === current || pending) return;
    if (choice === "cancelled") setConfirming(true); // destructive: ask first
    else save(choice);
  }

  return (
    <form className="status-form" onSubmit={onSubmit}>
      <div className="field">
        <label htmlFor="order-status">Order status</label>
        <select id="order-status" value={choice} onChange={(event) => setChoice(event.target.value)} disabled={pending}>
          {ORDER_STATUSES.map((status) => (
            <option key={status} value={status}>
              {STATUS_LABELS[status]}
            </option>
          ))}
        </select>
      </div>
      <Button type="submit" variant="primary" disabled={pending || choice === current}>
        {pending && !confirming ? "Saving…" : "Update status"}
      </Button>

      <p className={`admin-message${message ? ` admin-message--${message.type}` : ""}`} role={message?.type === "error" ? "alert" : "status"}>
        {message?.text}
      </p>

      <ConfirmDialog
        open={confirming}
        title={`Cancel order #${orderId}?`}
        confirmLabel="Cancel the order"
        pending={pending}
        onConfirm={() => save("cancelled")}
        onCancel={() => {
          setConfirming(false);
          setChoice(current);
        }}
      >
        <p>The customer will see this order as cancelled and the courier stops. You can undo it later by choosing another status.</p>
      </ConfirmDialog>
    </form>
  );
}
