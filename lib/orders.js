import "server-only";
import crypto from "node:crypto";
import { getDishes } from "./dishes.js";
import { getDeliveryFee, getDeliveryArea } from "./delivery.js";
import { validateOrder } from "./validate.js";
import { sortRows, paginate, PAGE_SIZE } from "./order-table.js";
import { KITCHEN } from "./delivery.js";
import { ON_THE_WAY_AFTER_SECONDS, DEMO_RIDE_SECONDS, lerpPosition, rideProgress } from "./tracking.js";

// In-memory order store: enough for a single `next start` process and the demo.
// It sits on globalThis so dev-server module reloads do not wipe it.
const orders = (globalThis.__addisEatsOrders ??= new Map());

// Turn client-supplied { id, quantity } lines into priced lines using OUR
// dish data. Anything the client says about price or name is ignored.
export async function priceLines(lines) {
  const dishes = await getDishes();
  const byId = new Map(dishes.map((dish) => [dish.id, dish]));
  const priced = [];
  const unknown = [];
  for (const line of lines) {
    const dish = byId.get(line.id);
    if (!dish) {
      unknown.push(line.id);
      continue;
    }
    priced.push({
      id: dish.id,
      name: dish.name,
      price: dish.price,
      image: dish.image,
      quantity: line.quantity,
    });
  }
  const subtotal = priced.reduce((sum, line) => sum + line.price * line.quantity, 0);
  return { lines: priced, subtotal, unknown };
}

// A second identical order from the same customer inside this window is treated as a
// repeat of the first (a double tap, a retried request) and returns the SAME order
// instead of creating another. The disabled button stops the common case in the
// browser; this stops it on the server, where it counts.
export const DUPLICATE_WINDOW_MS = 10_000;

// Used by BOTH the placeOrder action and POST /api/orders.
// Check order matters: shape (422) → who are you (401) → do the dishes exist (422).
export async function createOrder(input, session) {
  const errors = validateOrder(input);
  if (Object.keys(errors).length > 0) {
    return { ok: false, status: 422, error: "The order has invalid fields.", fieldErrors: errors };
  }
  if (!session) {
    return { ok: false, status: 401, error: "Sign in to place an order." };
  }

  const { lines, subtotal, unknown } = await priceLines(input.items);
  if (unknown.length > 0) {
    return {
      ok: false,
      status: 422,
      error: "The order has invalid fields.",
      fieldErrors: { items: "Some dishes are no longer on the menu." },
    };
  }

  const address = input.address.trim();
  const signature = JSON.stringify([
    input.area,
    address,
    lines.map((line) => [line.id, line.quantity]).sort((a, b) => (a[0] < b[0] ? -1 : 1)),
  ]);
  const repeat = [...orders.values()].find(
    (o) => o.ownerId === session.uid && !o.cancelled && o.signature === signature && Date.now() - o.createdAt < DUPLICATE_WINDOW_MS
  );
  if (repeat) return { ok: true, status: 200, order: repeat, duplicate: true };

  const deliveryFee = getDeliveryFee(input.area);
  let id;
  do {
    id = `AE-${crypto.randomInt(10000, 100000)}`;
  } while (orders.has(id));
  const order = {
    id,
    ownerId: session.uid,
    customer: { name: input.name.trim(), phone: input.phone.trim() },
    area: input.area,
    address,
    signature,
    instructions: (input.instructions || "").trim(),
    items: lines,
    subtotal,
    deliveryFee,
    total: subtotal + deliveryFee,
    createdAt: Date.now(),
    cancelled: false,
  };
  orders.set(order.id, order);
  return { ok: true, status: 201, order };
}

// Status is derived from age, so there is nothing to keep in sync.
export function getStatus(order, now = Date.now()) {
  if (order.cancelled) return "cancelled";
  const seconds = (now - order.createdAt) / 1000;
  if (seconds < 30) return "received";
  if (seconds < 90) return "preparing";
  return "on_the_way";
}

// Authorisation lives HERE, next to the data: an order is only ever returned
// to the session that owns it. Not-yours and not-found are indistinguishable.
export function getOrderFor(id, session) {
  if (!session) return null;
  const order = orders.get(id);
  return order && order.ownerId === session.uid ? order : null;
}

// The list for /orders. The query is built from the SESSION's own id — there is no
// id parameter at all, so there is nothing to tamper with.
export function getOrdersFor(session) {
  if (!session) return [];
  return [...orders.values()].filter((order) => order.ownerId === session.uid).sort((a, b) => b.createdAt - a.createdAt);
}

// ---- Table rows (Day 46) --------------------------------------------------------
// What a table needs, and nothing more: no owner id, no phone, no street address.
function toRow(order) {
  return {
    id: order.id,
    createdAt: order.createdAt,
    area: order.area,
    total: order.total,
    status: getStatus(order),
    customer: order.customer.name.trim().split(" ")[0],
  };
}

// One page of the SIGNED-IN customer's orders, sorted. The list is built from the
// session's own id; `sort`, `dir` and `page` only change the ORDER and the WINDOW of
// that list, never whose orders it is.
export function getOrderRowsFor(session, { sort = "date", dir = "desc", page = 1, pageSize = PAGE_SIZE } = {}) {
  const rows = getOrdersFor(session).map(toRow);
  return paginate(sortRows(rows, sort, dir), page, pageSize);
}

// Every order, one page, for the staff dashboard. The role check is inside, as in
// listAllOrders — null for anyone who is not staff.
export function getAllOrderRows(session, { sort = "date", dir = "desc", page = 1, pageSize = PAGE_SIZE } = {}) {
  const all = listAllOrders(session);
  if (!all) return null;
  return paginate(sortRows(all.map(toRow), sort, dir), page, pageSize);
}

// The signed-in customer's whole history, for the CSV export.
export function getExportRowsFor(session) {
  return getOrdersFor(session).map((order) => ({ ...toRow(order), address: order.address, items: order.items, subtotal: order.subtotal, deliveryFee: order.deliveryFee }));
}

// ---- Tracking (Day 47) ----------------------------------------------------------
// Status, demo courier position and whether the stream can stop — one payload for the
// server render, the SSE stream and the map. See lib/tracking.js for why the courier
// is simulated.
export function getTracking(order, now = Date.now()) {
  const status = getStatus(order, now);
  const ageSeconds = (now - order.createdAt) / 1000;
  const progress = status === "on_the_way" ? rideProgress(ageSeconds) : 0;
  const arrived = status === "on_the_way" && ageSeconds >= ON_THE_WAY_AFTER_SECONDS + DEMO_RIDE_SECONDS;
  const area = getDeliveryAreaCenter(order.area);
  const courier = status === "cancelled" || !area ? null : lerpPosition(KITCHEN.position, area, progress);
  return {
    id: order.id,
    status,
    courier,
    arrived,
    // Nothing more will change: stop the stream deliberately.
    done: status === "cancelled" || arrived,
    at: now,
  };
}

function getDeliveryAreaCenter(areaId) {
  return getDeliveryArea(areaId)?.center ?? null;
}

// Every order, for the kitchen. The role check lives HERE, next to the data, so a
// forgotten check in a page cannot leak the list. Returns null unless staff.
export function listAllOrders(session) {
  if (session?.role !== "staff") return null;
  return [...orders.values()].sort((a, b) => b.createdAt - a.createdAt);
}

export function cancelOrderFor(id, session) {
  if (!session) return { ok: false, status: 401, error: "Sign in first." };
  const order = getOrderFor(id, session);
  if (!order) return { ok: false, status: 404, error: "Order not found." };
  const status = getStatus(order);
  if (status === "cancelled") return { ok: true, status: 200, order };
  if (status === "on_the_way") {
    return { ok: false, status: 409, error: "The order is already on its way and cannot be cancelled." };
  }
  order.cancelled = true;
  return { ok: true, status: 200, order };
}

// What may leave the server. No owner id.
export function toPublicOrder(order) {
  const { ownerId, signature, ...rest } = order; // eslint-disable-line no-unused-vars
  return { ...rest, status: getStatus(order) };
}
