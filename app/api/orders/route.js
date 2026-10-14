import { getSession } from "@/lib/session";
import { createOrder, getOrderFor, toPublicOrder } from "@/lib/orders";

// POST /api/orders — place an order from outside our own UI. It runs the SAME
// createOrder (and so the same shared validation schema) as the placeOrder action.
//   415 Content-Type is not JSON · 400 body is not JSON · 422 invalid fields
//   401 not signed in · 201 created · 200 the same order again (a repeat within 10 s)
export async function POST(request) {
  // Checked before the body is read, so a form-encoded post never reaches validation.
  const mediaType = (request.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  if (mediaType !== "application/json" && !mediaType.endsWith("+json")) {
    return Response.json({ error: 'Content-Type must be "application/json".' }, { status: 415 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const result = await createOrder(body, await getSession());
  if (!result.ok) {
    return Response.json(
      { error: result.error, ...(result.fieldErrors ? { fieldErrors: result.fieldErrors } : {}) },
      { status: result.status }
    );
  }
  // 201 for a new order; 200 when it was a repeat of one just placed (same order back).
  return Response.json({ order: toPublicOrder(result.order) }, { status: result.status });
}

// GET /api/orders?id=AE-12345 — the status poll used by the confirmation page.
// A browser-triggered, repeated read: exactly what a route handler is for.
// Someone else's order and a missing order both answer 404.
export async function GET(request) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Sign in to view orders." }, { status: 401 });
  }
  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    return Response.json({ error: "Missing ?id= parameter." }, { status: 400 });
  }
  const order = getOrderFor(id, session);
  if (!order) {
    return Response.json({ error: "Order not found." }, { status: 404 });
  }
  return Response.json({ order: toPublicOrder(order) });
}
