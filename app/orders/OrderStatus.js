"use client";
// Client because SWR is a hook. This replaces the hand-written setInterval,
// AbortController, cleanup and status state that OrderTracker held on Day 40.
//
// The server renders the order first and passes it in as `initial`, which becomes
// fallbackData: the page arrives with its real status — no spinner — and the
// polling starts after hydration.
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";

export const STATUS_LABELS = {
  received: "Order received — the kitchen has it.",
  preparing: "Preparing your food.",
  on_the_way: "On its way to you! 🛵",
  cancelled: "This order was cancelled.",
};
const FINAL = new Set(["on_the_way", "cancelled"]);

export default function OrderStatus({ id, initial }) {
  const { data, error } = useSWR(`/api/orders/${encodeURIComponent(id)}`, fetcher, {
    fallbackData: { order: initial },
    // Poll every 5 s until the order reaches a final status, then stop.
    // (SWR also pauses polling while the tab is hidden.)
    refreshInterval: (latest) => (FINAL.has(latest?.order?.status) ? 0 : 5000),
  });

  const status = data?.order?.status ?? initial.status;

  return (
    <>
      <p className="order-status" role="status" aria-live="polite">
        {STATUS_LABELS[status] || STATUS_LABELS.received}
      </p>
      {error && (
        <p className="order-status-error" role="alert">
          Could not refresh the status — showing the last known one. {error.message}
        </p>
      )}
    </>
  );
}
