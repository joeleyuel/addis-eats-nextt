import "server-only";
import crypto from "node:crypto";
import { getDishes } from "./dishes.js";
import { getDeliveryFee, getDeliveryArea } from "./delivery.js";
import { validateOrder } from "./validate.js";
import { sortRows, paginate, PAGE_SIZE } from "./order-table.js";
import { KITCHEN } from "./delivery.js";
import { ON_THE_WAY_AFTER_SECONDS, DEMO_RIDE_SECONDS, lerpPosition, rideProgress } from "./tracking.js";
import { isAdminRole, isStaffRole } from "./roles.js";
import { ORDER_STATUSES } from "./order-status.js";
import { maskPhone } from "./privacy.js";
import { revenueByArea, ordersPerDay, totals } from "./stats.js";
import { dayKey } from "./format.js";

export { ORDER_STATUSES };

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

// Status is derived from age, so there is nothing to keep in sync — UNTIL an admin sets it
// by hand (setOrderStatusFor). A manual status is stored as `statusOverride` and wins over
// the clock from then on: that is what makes "update status" real instead of cosmetic.
// Cancelled always wins, so a customer's cancellation is never hidden by an override.
export function getStatus(order, now = Date.now()) {
  if (order.cancelled) return "cancelled";
  if (order.statusOverride) return order.statusOverride;
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

// Every order, for the kitchen (and the admin). The role check lives HERE, next to the data, so a
// forgotten check in a page cannot leak the list. Returns null unless staff.
export function listAllOrders(session) {
  if (!isStaffRole(session?.role)) return null; // staff and admin; nobody else
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

// What may leave the server to a CUSTOMER. No owner id, and none of the admin bookkeeping.
export function toPublicOrder(order) {
  const { ownerId, signature, statusOverride, updatedAt, updatedBy, ...rest } = order; // eslint-disable-line no-unused-vars
  return { ...rest, status: getStatus(order) };
}

// ---- Admin (the /admin console) ---------------------------------------------------------
// Same rule as everywhere else in this file: the role check is INSIDE the function, next to
// the data, so a page or handler that forgets it still cannot leak or change anything.
// Staff are not enough here — only the "admin" role passes.

// Every order, newest first, or null for anyone who is not an admin.
export function listOrdersForAdmin(session) {
  if (!isAdminRole(session?.role)) return null;
  return [...orders.values()].sort((a, b) => b.createdAt - a.createdAt);
}

export function getOrderForAdmin(id, session) {
  if (!isAdminRole(session?.role)) return null;
  return orders.get(id) ?? null;
}

// Set an order's status by hand. Answers like cancelOrderFor: { ok, status, error?, order? }.
//   401 not signed in · 403 not an admin · 422 unknown status · 404 no such order
// "cancelled" cancels; any other status also reinstates a cancelled order (an admin can undo
// a mistaken cancellation) and stops the clock from moving the order on by itself.
export function setOrderStatusFor(id, status, session, now = Date.now()) {
  if (!session) return { ok: false, status: 401, error: "Sign in first." };
  if (!isAdminRole(session.role)) return { ok: false, status: 403, error: "Admin access required." };
  if (typeof status !== "string" || !ORDER_STATUSES.includes(status)) {
    return { ok: false, status: 422, error: `Status must be one of: ${ORDER_STATUSES.join(", ")}.` };
  }
  const order = typeof id === "string" ? orders.get(id) : undefined;
  if (!order) return { ok: false, status: 404, error: "Order not found." };

  if (status === "cancelled") {
    order.cancelled = true;
  } else {
    order.cancelled = false;
    order.statusOverride = status;
  }
  order.updatedAt = now;
  order.updatedBy = session.name;
  return { ok: true, status: 200, order };
}

// ---- Admin views: rows, detail, customers, overview ----------------------------------------
// Everything below returns null unless the session is an admin, and returns ONLY what the
// screen shows. In particular the lists carry a MASKED phone number and no street address; the
// full phone and address appear only in adminOrderDetail (the delivery person needs them).
// Searching by phone digits happens in here, on the real number, so the full number never has
// to leave this module for a list.

const EAT_OFFSET = "+03:00"; // Africa/Addis_Ababa, no daylight saving
const DAY_MS = 86_400_000;

function toAdminRow(order, now) {
  return {
    id: order.id,
    createdAt: order.createdAt,
    status: getStatus(order, now),
    area: order.area,
    total: order.total,
    itemCount: order.items.reduce((sum, line) => sum + line.quantity, 0),
    customer: order.customer.name.trim(),
    phone: maskPhone(order.customer.phone),
    manual: Boolean(order.statusOverride) || (order.cancelled && Boolean(order.updatedBy)),
  };
}

// Filters: { q, status, area, from, to } (all optional; "" = no filter), already validated by
// lib/admin-filters.js. `from`/`to` are Addis Ababa calendar days, both inclusive.
function matchesOrder(order, filters) {
  const { q = "", area = "", from = "", to = "" } = filters;
  if (area && order.area !== area) return false;
  if (from && order.createdAt < Date.parse(`${from}T00:00:00${EAT_OFFSET}`)) return false;
  if (to && order.createdAt >= Date.parse(`${to}T00:00:00${EAT_OFFSET}`) + DAY_MS) return false;
  const term = q.trim().toLowerCase();
  if (term) {
    const digits = term.replace(/\D/g, "");
    const inText = `${order.id} ${order.customer.name}`.toLowerCase().includes(term);
    const inPhone = digits.length >= 3 && order.customer.phone.replace(/\D/g, "").includes(digits);
    if (!inText && !inPhone) return false;
  }
  return true;
}

// One page of orders for /admin/orders, plus how many orders each status has under the OTHER
// filters (so the status tabs can show honest counts).
export function queryAdminOrders(session, filters = {}, { sort = "date", dir = "desc", page = 1, pageSize = PAGE_SIZE, now = Date.now() } = {}) {
  const all = listOrdersForAdmin(session);
  if (!all) return null;

  const withStatus = all.map((order) => ({ order, status: getStatus(order, now) })).filter(({ order }) => matchesOrder(order, filters));
  const counts = { all: withStatus.length };
  for (const status of ORDER_STATUSES) counts[status] = withStatus.filter((entry) => entry.status === status).length;

  const rows = withStatus.filter((entry) => !filters.status || entry.status === filters.status).map(({ order }) => toAdminRow(order, now));
  return { ...paginate(sortRows(rows, sort, dir), page, pageSize), counts };
}

// The whole order, for its detail page. Null for a non-admin AND for an unknown id.
export function adminOrderDetail(id, session, now = Date.now()) {
  const order = getOrderForAdmin(id, session);
  if (!order) return null;
  return {
    id: order.id,
    createdAt: order.createdAt,
    status: getStatus(order, now),
    manual: Boolean(order.statusOverride) || (order.cancelled && Boolean(order.updatedBy)),
    area: order.area,
    address: order.address,
    instructions: order.instructions,
    customer: { name: order.customer.name, phone: order.customer.phone },
    items: order.items.map(({ id: dishId, name, price, quantity }) => ({ id: dishId, name, price, quantity })),
    subtotal: order.subtotal,
    deliveryFee: order.deliveryFee,
    total: order.total,
    updatedAt: order.updatedAt ?? null,
    updatedBy: order.updatedBy ?? null,
  };
}

export const CUSTOMER_SORTS = ["spent", "orders", "last", "name"];

// Customers are not stored anywhere: sign-in keeps no user table, so a "customer" here is the
// person behind a set of orders (grouped by the session's uid, which comes from the phone
// number). Someone who signed in but never ordered does not appear. Cancelled orders count as
// cancelled, not as spend.
export function queryAdminCustomers(session, { q = "", sort = "spent", dir = "desc", page = 1, pageSize = PAGE_SIZE } = {}) {
  const all = listOrdersForAdmin(session);
  if (!all) return null;

  const byOwner = new Map();
  for (const order of all) {
    // `all` is newest first, so the first order seen for a person gives their latest name.
    const entry = byOwner.get(order.ownerId) ?? { name: order.customer.name.trim(), phone: order.customer.phone, orders: 0, cancelled: 0, spent: 0, lastOrderAt: 0 };
    if (order.cancelled) entry.cancelled += 1;
    else {
      entry.orders += 1;
      entry.spent += order.total;
    }
    entry.lastOrderAt = Math.max(entry.lastOrderAt, order.createdAt);
    byOwner.set(order.ownerId, entry);
  }

  const term = q.trim().toLowerCase();
  const digits = term.replace(/\D/g, "");
  let list = [...byOwner.values()].filter(
    (c) => !term || c.name.toLowerCase().includes(term) || (digits.length >= 3 && c.phone.replace(/\D/g, "").includes(digits))
  );

  const sign = dir === "asc" ? 1 : -1;
  const key = CUSTOMER_SORTS.includes(sort) ? sort : "spent";
  const value = { spent: (c) => c.spent, orders: (c) => c.orders, last: (c) => c.lastOrderAt, name: (c) => c.name.toLowerCase() }[key];
  list = list.sort((a, b) => (value(a) < value(b) ? -sign : value(a) > value(b) ? sign : b.lastOrderAt - a.lastOrderAt));

  // Mask AFTER searching and sorting: the raw number stops here.
  const safe = list.map(({ phone, ...rest }) => ({ ...rest, phone: maskPhone(phone) }));
  return { ...paginate(safe, page, pageSize), totalCustomers: byOwner.size };
}

// The numbers on /admin, all computed from the orders that exist right now.
export function adminOverview(session, now = Date.now()) {
  const all = listOrdersForAdmin(session);
  if (!all) return null;

  const statusCounts = Object.fromEntries(ORDER_STATUSES.map((s) => [s, 0]));
  for (const order of all) statusCounts[getStatus(order, now)] += 1;

  const today = dayKey(now);
  const todays = all.filter((o) => dayKey(o.createdAt) === today);

  const dishTotals = new Map();
  for (const order of all) {
    if (order.cancelled) continue;
    for (const line of order.items) {
      const entry = dishTotals.get(line.id) ?? { id: line.id, name: line.name, quantity: 0, revenue: 0 };
      entry.quantity += line.quantity;
      entry.revenue += line.price * line.quantity;
      dishTotals.set(line.id, entry);
    }
  }

  // Recent activity, newest first: orders being placed and admins changing a status. Only the
  // latest manual change per order is remembered, so that is all this can show.
  const activity = [];
  for (const order of all) {
    activity.push({ type: "placed", at: order.createdAt, orderId: order.id, actor: order.customer.name.trim().split(" ")[0] });
    if (order.updatedAt) {
      activity.push({ type: "status", at: order.updatedAt, orderId: order.id, status: getStatus(order, now), actor: order.updatedBy });
    }
  }
  activity.sort((a, b) => b.at - a.at);

  return {
    totals: totals(all),
    today: totals(todays),
    customers: new Set(all.map((o) => o.ownerId)).size,
    activeOrders: statusCounts.received + statusCounts.preparing,
    statusCounts,
    byArea: revenueByArea(all),
    perDay: ordersPerDay(all, { now }),
    topDishes: [...dishTotals.values()].sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue).slice(0, 5),
    latest: all.slice(0, 5).map((o) => toAdminRow(o, now)),
    activity: activity.slice(0, 8),
    orderCount: all.length,
  };
}
