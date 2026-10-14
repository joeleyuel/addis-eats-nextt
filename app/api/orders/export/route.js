import { getSession } from "@/lib/session";
import { getExportRowsFor } from "@/lib/orders";
import { toCsv } from "@/lib/csv";
import { when } from "@/lib/format";

// GET /api/orders/export — the signed-in customer's whole order history as CSV (Day 47).
// Built here rather than in the browser: the history is paged on screen, so the page
// does not hold all of it, and this scales past a few thousand rows without freezing a
// tab. Scoped to the SESSION — there is no id or filter in the request to tamper with.
// Static segment, so it wins over /api/orders/[id]; no order id can be "export".
export const dynamic = "force-dynamic";

const HEADERS = [
  "Order",
  "Placed (UTC)",
  "Placed (Addis Ababa)",
  "Status",
  "Area",
  "Address",
  "Items",
  "Subtotal (ETB)",
  "Delivery fee (ETB)",
  "Total (ETB)",
];

export async function GET() {
  const session = await getSession();
  if (!session) return Response.json({ error: "Sign in to export orders." }, { status: 401 });

  const rows = getExportRowsFor(session).map((order) => [
    order.id,
    new Date(order.createdAt).toISOString(),
    when.format(new Date(order.createdAt)),
    order.status,
    order.area,
    order.address,
    order.items.map((item) => `${item.quantity}x ${item.name}`).join("; "),
    order.subtotal,
    order.deliveryFee,
    order.total,
  ]);

  // BOM: so Excel reads the file as UTF-8.
  const body = "\uFEFF" + toCsv(HEADERS, rows);
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="addis-eats-orders.csv"',
      "Cache-Control": "no-store",
    },
  });
}
