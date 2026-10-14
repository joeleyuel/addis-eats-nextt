import { getSession } from "@/lib/session";
import { getOrderFor, toPublicOrder } from "@/lib/orders";

// GET /api/orders/AE-12345 — the SWR key for the order-status screen.
// Same rules as GET /api/orders?id=…: 401 without a session, and someone
// else's order is indistinguishable from a missing one (404).
export async function GET(_request, { params }) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Sign in to view orders." }, { status: 401 });
  }
  const order = getOrderFor(params.id, session);
  if (!order) {
    return Response.json({ error: "Order not found." }, { status: 404 });
  }
  return Response.json({ order: toPublicOrder(order) });
}
