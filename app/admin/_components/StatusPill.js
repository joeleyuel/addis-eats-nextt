import { STATUS_LABELS } from "@/lib/order-status";

// Colour is never the only signal: the label says the status in words.
export default function StatusPill({ status }) {
  return <span className={`status-pill status-pill--${status}`}>{STATUS_LABELS[status] ?? status}</span>;
}
