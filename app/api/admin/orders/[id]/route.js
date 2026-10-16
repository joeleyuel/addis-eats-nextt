import { authorizeAdmin, adminJson, readJsonBody } from "@/lib/admin-api";
import { adminOrderDetail, setOrderStatusFor } from "@/lib/orders";

// Admin only. The handler gate (authorizeAdmin) answers 401 / 403; adminOrderDetail and
// setOrderStatusFor check the role again next to the data.
//   GET   /api/admin/orders/AE-12345                  → { order }   (full detail, incl. phone + address)
//   PATCH /api/admin/orders/AE-12345  { "status": "preparing" }   → { order }
//         422 unknown status · 404 no such order · 415/400/413 bad body · 403 cross-site
export const dynamic = "force-dynamic";

const ORDER_ID = /^AE-\d{5}$/;

export async function GET(request, { params }) {
  const gate = await authorizeAdmin(request);
  if (gate.response) return gate.response;
  const order = ORDER_ID.test(params.id) ? adminOrderDetail(params.id, gate.session) : null;
  if (!order) return adminJson({ error: "Order not found." }, 404);
  return adminJson({ order });
}

export async function PATCH(request, { params }) {
  const gate = await authorizeAdmin(request, { write: true });
  if (gate.response) return gate.response;

  const parsed = await readJsonBody(request);
  if (parsed.response) return parsed.response;

  if (!ORDER_ID.test(params.id)) return adminJson({ error: "Order not found." }, 404);
  const result = setOrderStatusFor(params.id, parsed.body.status, gate.session);
  if (!result.ok) return adminJson({ error: result.error }, result.status);
  return adminJson({ order: adminOrderDetail(params.id, gate.session) });
}
