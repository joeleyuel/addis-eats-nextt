// The four order statuses and how to say them. No imports, shared by server and client code.
// (The API contract has four statuses; "delivered" was cut on purpose — see FUTURE.md.)
export const ORDER_STATUSES = ["received", "preparing", "on_the_way", "cancelled"];

export const STATUS_LABELS = {
  received: "Received",
  preparing: "Preparing",
  on_the_way: "On the way",
  cancelled: "Cancelled",
};
