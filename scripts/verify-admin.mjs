// Admin console — logic-level checks against the REAL modules: lib/session, lib/admin-auth,
// lib/orders, lib/dishes, lib/dish-validate, lib/admin-filters, the admin sign-in action and
// the /api/admin route handlers. Only the framework edges (cookies(), headers(), redirect(),
// revalidatePath(), server-only) are stand-ins (scripts/stubs). Dish writes go to a TEMP COPY of
// the menu (MENU_DATA_FILE), never to data/menu-data.json.
//
//   npm test
//
// Not covered here (needs a browser): rendering, the sidebar on a phone, the confirm dialog,
// focus handling, real HTTPS cookies. See ADMIN.md › Verification.
import { register } from "node:module";
import assert from "node:assert/strict";
import { copyFileSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const dir = mkdtempSync(path.join(tmpdir(), "addis-admin-"));
const menuCopy = path.join(dir, "menu.json");
copyFileSync(new URL("../data/menu-data.json", import.meta.url), menuCopy);

process.env.NODE_ENV = "production";
process.env.SESSION_SECRET = "test-secret-at-least-16-chars";
process.env.STAFF_PHONES = "0922000000";
process.env.ADMIN_PHONES = "0933000000";
process.env.ADMIN_ACCESS_CODE = "correct-horse-battery-staple";
process.env.MENU_DATA_FILE = menuCopy;
register("./stubs/hooks.mjs", import.meta.url);

const { jar } = await import("./stubs/next-headers.mjs");
const { headerJar } = await import("./stubs/next-headers.mjs");
const { revalidated } = await import("./stubs/next-cache.mjs");
const { Redirected, NotFound } = await import("./stubs/next-navigation.mjs");
const session = await import("../lib/session.js");
const orders = await import("../lib/orders.js");
const dishes = await import("../lib/dishes.js");
const adminAuth = await import("../lib/admin-auth.js");
const actions = await import("../app/actions.js");
const adminActions = await import("../app/admin/actions.js");
const { CART_COOKIE } = await import("../lib/cart.js");
const { validateDishInput, slugify, isValidImagePath } = await import("../lib/dish-validate.js");
const filters = await import("../lib/admin-filters.js");
const { safeAdminNext, adminSignInUrl } = await import("../lib/safe-next.js");
const { maskPhone } = await import("../lib/privacy.js");
const { createLimiter } = await import("../lib/rate-limit.js");
const orderRoute = await import("../app/api/admin/orders/[id]/route.js");
const dishesRoute = await import("../app/api/admin/dishes/route.js");
const dishRoute = await import("../app/api/admin/dishes/[id]/route.js");

let passed = 0;
const failures = [];
async function check(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`  ok   ${name}`);
  } catch (error) {
    failures.push(name);
    console.log(`  FAIL ${name}\n       ${String(error.message).split("\n")[0]}`);
  }
}

const form = (fields) => {
  const data = new FormData();
  for (const [k, v] of Object.entries(fields)) data.set(k, v);
  return data;
};
async function redirectOf(fn) {
  try {
    await fn();
  } catch (error) {
    if (error instanceof Redirected) return error.url;
    throw error;
  }
  return null;
}
const signedOut = () => jar.values.delete(session.SESSION_COOKIE);
const useToken = (t) => jar.values.set(session.SESSION_COOKIE, t);
const cookieNow = () => jar.values.get(session.SESSION_COOKIE);
async function customerSignIn(name, phone) {
  await redirectOf(() => actions.signIn(form({ name, phone, next: "/" })));
  return cookieNow();
}
const ADMIN = { name: "Owner Admin", phone: "0933000000", code: "correct-horse-battery-staple" };
async function adminSignIn(extra = {}) {
  signedOut();
  const to = await redirectOf(() => adminActions.adminSignIn(form({ ...ADMIN, next: "/admin", ...extra })));
  return { to, token: cookieNow() };
}
async function place(token, phone, name, area, address, items) {
  useToken(token);
  jar.values.set(CART_COOKIE, JSON.stringify(items));
  const to = await redirectOf(() => actions.placeOrder({}, form({ name, phone, area, address })));
  return decodeURIComponent(to.split("=")[1]);
}
const api = (method, url, { body, headers = {}, raw } = {}) =>
  new Request(`http://localhost${url}`, {
    method,
    headers: { host: "localhost", origin: "http://localhost", "content-type": "application/json", ...headers },
    body: raw ?? (body === undefined ? undefined : JSON.stringify(body)),
  });

// ---------------------------------------------------------------------------------------------
console.log("Admin role: who can get it");
let adminToken;
await check("the NORMAL sign-in never grants admin — not even for an ADMIN_PHONES number, not even with role=admin in the form", async () => {
  const token = await customerSignIn("Owner Admin", "0933000000");
  assert.equal(session.readSessionToken(token).role, "customer");
  await redirectOf(() => actions.signIn(form({ name: "Owner Admin", phone: "0933000000", role: "admin", code: ADMIN.code, next: "/" })));
  assert.equal(session.readSessionToken(cookieNow()).role, "customer");
  assert.equal(session.roleForPhone("0933000000"), "customer");
});
await check("admin sign-in: wrong code, right code with a non-admin phone, empty code → all refused with the SAME error, no cookie", async () => {
  const urls = [];
  for (const extra of [{ code: "wrong-code-wrong-code" }, { phone: "0911234567" }, { code: "" }]) {
    const { to, token } = await adminSignIn(extra);
    assert.equal(token, undefined);
    urls.push(to);
  }
  assert.ok(urls.every((u) => u === "/admin/signin?next=%2Fadmin&error=invalid"), urls.join(" | "));
});
await check("admin sign-in with phone + code → admin session, 4 h cookie, httpOnly/secure/lax, role signed in the token", async () => {
  adminAuth.adminLoginLimiter.ip.clear("unknown");
  adminAuth.adminLoginLimiter.phone.clear("0933000000");
  const { to, token } = await adminSignIn();
  assert.equal(to, "/admin");
  adminToken = token;
  const claims = session.readSessionToken(token);
  assert.equal(claims.role, "admin");
  const write = jar.writes.filter((w) => w.name === session.SESSION_COOKIE).at(-1);
  assert.equal(write.options.maxAge, 60 * 60 * 4);
  assert.equal(write.options.httpOnly, true);
  assert.equal(write.options.secure, true);
  assert.equal(write.options.sameSite, "lax");
});
await check("a forged admin role (payload edited, old signature kept) is rejected", async () => {
  const customer = await customerSignIn("Abel Tesfaye", "0912345678");
  const [payload, signature] = customer.split(".");
  const claims = JSON.parse(Buffer.from(payload, "base64url").toString());
  claims.role = "admin";
  const forged = `${Buffer.from(JSON.stringify(claims)).toString("base64url")}.${signature}`;
  assert.equal(session.readSessionToken(forged), null);
});
await check("?next on the admin sign-in cannot leave /admin (open redirect), in the action too", async () => {
  for (const evil of ["https://example.com", "//example.com", "/\\example.com", "/administrator", "/orders", "/admin/signin", ""]) {
    assert.equal(safeAdminNext(evil), "/admin", evil);
  }
  assert.equal(safeAdminNext("/admin/orders?status=received"), "/admin/orders?status=received");
  const { to } = await adminSignIn({ next: "https://example.com" });
  assert.equal(to, "/admin");
  assert.equal(adminSignInUrl("/admin/dishes"), "/admin/signin?next=%2Fadmin%2Fdishes");
});
await check("guessing the code is slowed down: 5 failures from one address → locked, even for the right code", async () => {
  headerJar.set("x-forwarded-for", "203.0.113.9");
  for (let i = 0; i < 5; i += 1) await adminSignIn({ code: `wrong-guess-number-${i}`, phone: `09110000${i}0` });
  const { to, token } = await adminSignIn();
  assert.equal(token, undefined);
  assert.match(to, /error=locked/);
  headerJar.delete("x-forwarded-for");
  adminAuth.adminLoginLimiter.phone.clear("0933000000");
});
await check("fails closed: no ADMIN_ACCESS_CODE (or one that is too short) → nobody can sign in as admin", async () => {
  const saved = process.env.ADMIN_ACCESS_CODE;
  for (const value of ["", "short"]) {
    process.env.ADMIN_ACCESS_CODE = value;
    assert.equal(adminAuth.verifyAdminCredentials({ phone: ADMIN.phone, code: value }), false);
    const { to, token } = await adminSignIn({ code: value });
    assert.equal(token, undefined);
    assert.match(to, /error=off/);
  }
  process.env.ADMIN_ACCESS_CODE = saved;
});
await check("limiter: counts inside the window only, clear() resets, size is capped", () => {
  const limiter = createLimiter({ max: 2, windowMs: 1000, maxKeys: 3 });
  limiter.fail("a", 0);
  limiter.fail("a", 10);
  assert.ok(limiter.retryAfter("a", 20) > 0);
  assert.equal(limiter.retryAfter("a", 1500), 0);
  limiter.clear("a");
  for (const k of ["b", "c", "d", "e"]) limiter.fail(k, 0);
  assert.ok(limiter.size() <= 3);
});

// ---------------------------------------------------------------------------------------------
console.log("Orders: admin-only reads and the status change");
const staffToken = await customerSignIn("Sara Kitchen", "0922000000");
const almazToken = await customerSignIn("Almaz Bekele", "0911234567");
const abelToken = await customerSignIn("Abel Tesfaye", "0912345678");
const id1 = await place(almazToken, "0911234567", "Almaz Bekele", "bole", "Bole Road, house 12", [{ id: "doro-wot-deluxe", quantity: 2 }]);
const id2 = await place(abelToken, "0912345678", "Abel Tesfaye", "cmc", "CMC block 4", [{ id: "awaze-beef-tibs", quantity: 1 }]);
const asAdmin = () => (useToken(adminToken), session.getSession());
const asRole = async (token) => (useToken(token), session.getSession());

await check("customer and STAFF get null from every admin data function; only admin gets data", async () => {
  for (const token of [almazToken, staffToken]) {
    const s = await asRole(token);
    assert.equal(orders.listOrdersForAdmin(s), null);
    assert.equal(orders.queryAdminOrders(s, {}), null);
    assert.equal(orders.queryAdminCustomers(s, {}), null);
    assert.equal(orders.adminOverview(s), null);
    assert.equal(orders.adminOrderDetail(id1, s), null);
  }
  assert.equal(orders.listOrdersForAdmin(null), null);
  const admin = await asAdmin();
  assert.equal(orders.listOrdersForAdmin(admin).length, 2);
  // staff keep the kitchen/dashboard list; admin has it too
  assert.ok(orders.listAllOrders(await asRole(staffToken)));
  assert.ok(orders.listAllOrders(admin));
});
await check("setOrderStatusFor: 401 signed out · 403 customer/staff · 422 bad status · 404 unknown — and nothing changes", async () => {
  assert.equal(orders.setOrderStatusFor(id1, "preparing", null).status, 401);
  assert.equal(orders.setOrderStatusFor(id1, "preparing", await asRole(almazToken)).status, 403);
  assert.equal(orders.setOrderStatusFor(id1, "preparing", await asRole(staffToken)).status, 403);
  const admin = await asAdmin();
  assert.equal(orders.setOrderStatusFor(id1, "delivered", admin).status, 422);
  assert.equal(orders.setOrderStatusFor(id1, { $ne: 1 }, admin).status, 422);
  assert.equal(orders.setOrderStatusFor("AE-00000", "preparing", admin).status, 404);
  assert.equal(orders.adminOrderDetail(id1, admin).status, "received");
  assert.equal(orders.adminOrderDetail(id1, admin).manual, false);
});
await check("admin sets a status: it sticks (the clock no longer moves it), is recorded, and the CUSTOMER sees it", async () => {
  const admin = await asAdmin();
  const r = orders.setOrderStatusFor(id1, "on_the_way", admin);
  assert.equal(r.ok, true);
  const detail = orders.adminOrderDetail(id1, admin);
  assert.equal(detail.status, "on_the_way");
  assert.equal(detail.manual, true);
  assert.equal(detail.updatedBy, "Owner Admin");
  const mine = orders.getOrderFor(id1, await asRole(almazToken));
  assert.equal(orders.getStatus(mine), "on_the_way");
  assert.equal(orders.getStatus(mine, Date.now() + 10 * 60_000), "on_the_way");
  const pub = orders.toPublicOrder(mine);
  assert.equal(pub.status, "on_the_way");
  for (const key of ["ownerId", "statusOverride", "updatedBy", "updatedAt"]) assert.equal(key in pub, false, key);
});
await check("a customer cannot cancel an order the admin put on the way; the admin can cancel and reinstate", async () => {
  assert.equal(orders.cancelOrderFor(id1, await asRole(almazToken)).status, 409);
  const admin = await asAdmin();
  assert.equal(orders.setOrderStatusFor(id1, "cancelled", admin).ok, true);
  assert.equal(orders.adminOrderDetail(id1, admin).status, "cancelled");
  assert.equal(orders.setOrderStatusFor(id1, "preparing", admin).ok, true);
  assert.equal(orders.adminOrderDetail(id1, admin).status, "preparing");
});
await check("lists carry a MASKED phone and no address / owner id; the full phone is only in the detail", async () => {
  const admin = await asAdmin();
  const result = orders.queryAdminOrders(admin, {});
  const json = JSON.stringify(result);
  assert.equal(json.includes("0911234567"), false);
  assert.equal(json.includes("Bole Road"), false);
  assert.equal(json.includes("ownerId"), false);
  assert.ok(result.rows.every((r) => r.phone.includes("•••")));
  const detail = orders.adminOrderDetail(id1, admin);
  assert.equal(detail.customer.phone, "0911234567");
  assert.equal(detail.address, "Bole Road, house 12");
  assert.equal(maskPhone("0911234567"), "0911 ••• 567");
});
await check("search and filters: by order id, name, phone digits (searched on the real number), status, area, date range", async () => {
  const admin = await asAdmin();
  const ids = (f) => orders.queryAdminOrders(admin, f).rows.map((r) => r.id).sort();
  assert.deepEqual(ids({ q: id2.toLowerCase() }), [id2]);
  assert.deepEqual(ids({ q: "almaz" }), [id1]);
  assert.deepEqual(ids({ q: "0912345678" }), [id2]);
  assert.deepEqual(ids({ q: "1234" }), [id1, id2].sort());
  assert.equal(ids({ q: "+" }).length, 0, "a query with no digits never matches a phone number");
  assert.equal(orders.queryAdminOrders(admin, { q: "09" }).rows.every((r) => r.id.includes("09") || r.customer.toLowerCase().includes("09")), true, "under 3 digits, phones are not searched");
  assert.deepEqual(ids({ status: "preparing" }), [id1]);
  assert.deepEqual(ids({ area: "cmc" }), [id2]);
  const today = filters.parseDay(new Date().toISOString().slice(0, 10));
  assert.equal(ids({ from: today, to: today }).length, 2);
  assert.equal(ids({ from: "2099-01-01" }).length, 0);
  assert.equal(ids({ to: "2000-01-01" }).length, 0);
  const counts = orders.queryAdminOrders(admin, {}).counts;
  assert.equal(counts.all, 2);
  assert.equal(counts.preparing, 1);
  assert.equal(counts.received, 1);
});
await check("customers: grouped per person, masked, cancelled not counted as spend, searchable by phone", async () => {
  const admin = await asAdmin();
  const result = orders.queryAdminCustomers(admin, {});
  assert.equal(result.total, 2);
  assert.equal(JSON.stringify(result).includes("0911234567"), false);
  assert.equal(orders.queryAdminCustomers(admin, { q: "0912345" }).rows[0].name, "Abel Tesfaye");
  orders.setOrderStatusFor(id2, "cancelled", admin);
  const abel = orders.queryAdminCustomers(admin, { q: "abel" }).rows[0];
  assert.equal(abel.spent, 0);
  assert.equal(abel.cancelled, 1);
  orders.setOrderStatusFor(id2, "received", admin);
});
await check("overview: every number is derived from the real orders", async () => {
  const admin = await asAdmin();
  const o = orders.adminOverview(admin);
  assert.equal(o.orderCount, 2);
  assert.equal(o.totals.orders, 2);
  assert.equal(o.totals.revenue, 2 * 480 + 80 + 450 + 110);
  assert.equal(o.customers, 2);
  assert.equal(o.activeOrders, 2);
  assert.equal(o.statusCounts.preparing + o.statusCounts.received, 2);
  assert.equal(o.topDishes[0].id, "doro-wot-deluxe");
  assert.equal(o.topDishes[0].quantity, 2);
  assert.equal(o.latest.length, 2);
  assert.ok(o.activity.some((e) => e.type === "status" && e.actor === "Owner Admin"));
  assert.equal(o.perDay.rows.length, 30);
  assert.equal(o.perDay.rows.at(-1).orders, 2);
});

// ---------------------------------------------------------------------------------------------
console.log("Dishes: validation, persistence, permissions");
await check("validateDishInput: whitelist, limits, id/rating ignored, control chars stripped, bad image paths refused", () => {
  const good = { name: "  Test\u0000 Tibs ", category: "Ethiopian", price: "250", prepMinutes: 15, spicy: true, vegan: false, image: "/images/Doro Wot Deluxe.jpg", shortDescription: "Short blurb here", description: "A long enough description of the dish.", ingredients: "Beef\nOnion\n\n" };
  const { errors, value } = validateDishInput({ ...good, id: "hacked", rating: 5, reviews: 999 });
  assert.deepEqual(errors, {});
  assert.equal(value.name, "Test Tibs");
  assert.equal(value.price, 250);
  assert.equal(value.prepTime, "15 mins");
  assert.deepEqual(value.ingredients, ["Beef", "Onion"]);
  for (const key of ["id", "rating", "reviews"]) assert.equal(key in value, false);
  for (const bad of [{ price: "-5" }, { price: 1.5 }, { price: "1e3" }, { price: 100001 }, { category: "All" }, { category: "Dessert" }, { name: "x" }, { prepMinutes: 0 }, { spicy: "maybe" }, { shortDescription: "tiny" }]) {
    assert.ok(Object.keys(validateDishInput({ ...good, ...bad }).errors).length > 0, JSON.stringify(bad));
  }
  for (const img of ["https://evil.example/a.jpg", "/images/../../etc/passwd.jpg", "/images/a.jpg?x=1", "/other/a.jpg", "/images/a.exe", "/images/a\\b.jpg", "images/a.jpg"]) {
    assert.equal(isValidImagePath(img), false, img);
  }
  assert.equal(isValidImagePath("/images/Fresh Mango & Avocado Spris.jpg"), true);
  assert.equal(slugify("Fresh Mango & Avocado Spris"), "fresh-mango-avocado-spris");
});
await check("every dish already on the menu passes the schema (editing one never starts with errors)", async () => {
  const { parsePrepMinutes } = await import("../lib/dish-validate.js");
  for (const d of await dishes.getDishes()) {
    const r = validateDishInput({ ...d, prepMinutes: parsePrepMinutes(d.prepTime), ingredients: d.ingredients });
    assert.deepEqual(r.errors, {}, d.id);
  }
});
await check("createDish/updateDish/deleteDish: 401 signed out · 403 customer + staff · file untouched", async () => {
  const before = readFileSync(menuCopy, "utf8");
  const input = { name: "Nope", category: "Pizza", price: 100, prepMinutes: 10, shortDescription: "Short blurb here", description: "A long enough description of the dish." };
  assert.equal((await dishes.createDish(input, null)).status, 401);
  for (const token of [almazToken, staffToken]) {
    const s = await asRole(token);
    assert.equal((await dishes.createDish(input, s)).status, 403);
    assert.equal((await dishes.updateDish("doro-wot-deluxe", input, s)).status, 403);
    assert.equal((await dishes.deleteDish("doro-wot-deluxe", s)).status, 403);
  }
  assert.equal(readFileSync(menuCopy, "utf8"), before);
});

const body = (extra = {}) => ({ name: "Test Special Tibs", category: "Ethiopian", price: 300, prepMinutes: 20, spicy: true, vegan: false, image: "", shortDescription: "A test dish for the suite", description: "A longer description so the validation passes.", ingredients: ["Beef", "Onion"], ...extra });
let createdId;
await check("POST /api/admin/dishes: 401 · 403 customer · 403 staff · 403 cross-site · 415 · 400 · 422 · 201", async () => {
  signedOut();
  assert.equal((await dishesRoute.POST(api("POST", "/api/admin/dishes", { body: body() }))).status, 401);
  for (const token of [almazToken, staffToken]) {
    useToken(token);
    assert.equal((await dishesRoute.POST(api("POST", "/api/admin/dishes", { body: body() }))).status, 403);
  }
  useToken(adminToken);
  assert.equal((await dishesRoute.POST(api("POST", "/api/admin/dishes", { body: body(), headers: { origin: "https://evil.example" } }))).status, 403);
  assert.equal((await dishesRoute.POST(api("POST", "/api/admin/dishes", { body: body(), headers: { "sec-fetch-site": "cross-site", origin: "" } }))).status, 403);
  assert.equal((await dishesRoute.POST(api("POST", "/api/admin/dishes", { body: "x", headers: { "content-type": "text/plain" } }))).status, 415);
  assert.equal((await dishesRoute.POST(api("POST", "/api/admin/dishes", { raw: "{nope" }))).status, 400);
  assert.equal((await dishesRoute.POST(api("POST", "/api/admin/dishes", { raw: "[]" }))).status, 400);
  assert.equal((await dishesRoute.POST(api("POST", "/api/admin/dishes", { raw: JSON.stringify({ pad: "x".repeat(40_000) }) }))).status, 413);
  const bad = await dishesRoute.POST(api("POST", "/api/admin/dishes", { body: body({ price: -1, name: "" }) }));
  assert.equal(bad.status, 422);
  const badJson = await bad.json();
  assert.ok(badJson.fieldErrors.price && badJson.fieldErrors.name);
  revalidated.length = 0;
  const ok = await dishesRoute.POST(api("POST", "/api/admin/dishes", { body: body({ id: "doro-wot-deluxe", rating: 5, reviews: 500 }) }));
  assert.equal(ok.status, 201);
  const { dish } = await ok.json();
  createdId = dish.id;
  assert.equal(dish.id, "test-special-tibs", "id comes from the name, not the request");
  assert.equal(dish.rating, 0);
  assert.equal(dish.reviews, 0);
  assert.deepEqual(revalidated.at(-1), ["/", "layout"], "menu, home, dish pages and sitemap are revalidated");
  assert.equal((await dishes.getDishById(createdId)).name, "Test Special Tibs", "really written to the file");
  assert.equal(JSON.parse(readFileSync(menuCopy, "utf8")).length, 14);
});
await check("duplicate names are refused (case-insensitive); a second dish with a similar name gets a unique id", async () => {
  useToken(adminToken);
  const dup = await dishesRoute.POST(api("POST", "/api/admin/dishes", { body: body({ name: "test special TIBS" }) }));
  assert.equal(dup.status, 422);
  assert.ok((await dup.json()).fieldErrors.name);
  const similar = await dishesRoute.POST(api("POST", "/api/admin/dishes", { body: body({ name: "Test Special Tibs!" }) }));
  assert.equal((await similar.json()).dish.id, "test-special-tibs-2");
  await dishRoute.DELETE(api("DELETE", "/api/admin/dishes/test-special-tibs-2"), { params: { id: "test-special-tibs-2" } });
});
await check("PUT /api/admin/dishes/:id updates the editable fields, keeps id/rating/reviews, and the file", async () => {
  useToken(adminToken);
  const before = await dishes.getDishById("doro-wot-deluxe");
  const put = (id, b, h) => dishRoute.PUT(api("PUT", `/api/admin/dishes/${id}`, { body: b, headers: h }), { params: { id } });
  const res = await put("doro-wot-deluxe", { ...body({ name: "Doro Wot Deluxe", price: 500, image: before.image }), id: "other", rating: 1 });
  assert.equal(res.status, 200);
  const { dish } = await res.json();
  assert.equal(dish.id, "doro-wot-deluxe");
  assert.equal(dish.price, 500);
  assert.equal(dish.rating, before.rating);
  assert.equal(dish.reviews, before.reviews);
  assert.equal((await dishes.getDishById("doro-wot-deluxe")).price, 500);
  assert.equal((await put("no-such-dish", body())).status, 404);
  assert.equal((await put("../../etc", body())).status, 404);
  assert.equal((await put("awaze-beef-tibs", body({ name: "doro wot deluxe" }))).status, 422, "another dish's name");
  signedOut();
  assert.equal((await put("doro-wot-deluxe", body())).status, 401);
  useToken(almazToken);
  assert.equal((await put("doro-wot-deluxe", body())).status, 403);
  assert.equal((await dishes.getDishById("doro-wot-deluxe")).price, 500);
});
await check("DELETE /api/admin/dishes/:id: 401 · 403 · 404 · 200; the last dish cannot be deleted; file stays valid JSON", async () => {
  const del = (id) => dishRoute.DELETE(api("DELETE", `/api/admin/dishes/${id}`), { params: { id } });
  signedOut();
  assert.equal((await del(createdId)).status, 401);
  useToken(staffToken);
  assert.equal((await del(createdId)).status, 403);
  useToken(adminToken);
  assert.equal((await del("nope")).status, 404);
  assert.equal((await del(createdId)).status, 200);
  assert.equal(await dishes.getDishById(createdId), null);
  const all = await dishes.getDishes();
  for (const d of all.slice(1)) assert.equal((await del(d.id)).status, 200);
  assert.equal((await del(all[0].id)).status, 409, "keep at least one dish");
  assert.equal(JSON.parse(readFileSync(menuCopy, "utf8")).length, 1);
});
await check("concurrent saves do not lose writes (the queue serialises them)", async () => {
  const admin = await asAdmin();
  const results = await Promise.all(["Alpha Dish", "Beta Dish", "Gamma Dish", "Delta Dish"].map((name) => dishes.createDish(body({ name }), admin)));
  assert.ok(results.every((r) => r.status === 201));
  assert.equal(JSON.parse(readFileSync(menuCopy, "utf8")).length, 5);
});
await check("a storage failure is never reported as success (the 503 for a read-only disk is NOT simulated here)", async () => {
  const saved = process.env.MENU_DATA_FILE;
  process.env.MENU_DATA_FILE = path.join(dir, "no-such-dir", "menu.json");
  useToken(adminToken);
  // reading fails first (ENOENT) → a 500, never a 2xx; a read-only-but-readable file is the 503 case
  const res = await dishesRoute.POST(api("POST", "/api/admin/dishes", { body: body({ name: "Zeta Dish" }) }));
  assert.ok(res.status >= 500, `status ${res.status}`);
  process.env.MENU_DATA_FILE = saved;
});

// ---------------------------------------------------------------------------------------------
console.log("Order status API");
await check("PATCH /api/admin/orders/:id: 401 · 403 customer · 403 staff · 403 cross-site · 415 · 422 · 404 · 200", async () => {
  const patch = (id, b, h) => orderRoute.PATCH(api("PATCH", `/api/admin/orders/${id}`, { body: b, headers: h }), { params: { id } });
  signedOut();
  assert.equal((await patch(id2, { status: "preparing" })).status, 401);
  for (const token of [almazToken, abelToken, staffToken]) {
    useToken(token);
    assert.equal((await patch(id2, { status: "preparing" })).status, 403);
  }
  useToken(adminToken);
  assert.equal((await patch(id2, { status: "preparing" }, { origin: "https://evil.example" })).status, 403);
  assert.equal((await orderRoute.PATCH(api("PATCH", `/api/admin/orders/${id2}`, { body: "x", headers: { "content-type": "text/plain" } }), { params: { id: id2 } })).status, 415);
  assert.equal((await patch(id2, { status: "shipped" })).status, 422);
  assert.equal((await patch(id2, {})).status, 422);
  assert.equal((await patch("AE-00000", { status: "preparing" })).status, 404);
  assert.equal((await patch("not-an-id", { status: "preparing" })).status, 404);
  assert.equal(orders.adminOrderDetail(id2, await asAdmin()).status, "received", "refused requests changed nothing");
  const ok = await patch(id2, { status: "preparing" });
  assert.equal(ok.status, 200);
  assert.equal((await ok.json()).order.status, "preparing");
  assert.equal(ok.headers.get("cache-control"), "no-store");
});
await check("GET /api/admin/orders/:id: 401 · 403 · 404 · 200 with full detail (admin only)", async () => {
  const get = (id) => orderRoute.GET(api("GET", `/api/admin/orders/${id}`), { params: { id } });
  signedOut();
  assert.equal((await get(id2)).status, 401);
  useToken(abelToken); // the order's OWN customer is still not an admin
  assert.equal((await get(id2)).status, 403);
  useToken(adminToken);
  assert.equal((await get("AE-00000")).status, 404);
  const ok = await get(id2);
  assert.equal(ok.status, 200);
  assert.equal((await ok.json()).order.customer.phone, "0912345678");
});
await check("an admin who signs out is locked out at once (token revoked), including the API", async () => {
  useToken(adminToken);
  await redirectOf(() => actions.signOut());
  useToken(adminToken); // replay the old cookie
  assert.equal(session.readSessionToken(adminToken), null);
  assert.equal((await orderRoute.GET(api("GET", `/api/admin/orders/${id2}`), { params: { id: id2 } })).status, 401);
});

// ---------------------------------------------------------------------------------------------
console.log("Pages: the gate every admin page calls");
await check("requireAdmin: signed out → /admin/signin?next=…; customer → not-found; staff → not-found; admin → session", async () => {
  signedOut();
  assert.equal(await redirectOf(() => adminAuth.requireAdmin("/admin/orders")), "/admin/signin?next=%2Fadmin%2Forders");
  for (const token of [almazToken, staffToken]) {
    useToken(token);
    await assert.rejects(() => adminAuth.requireAdmin("/admin"), NotFound);
  }
  const { token } = await adminSignIn();
  useToken(token);
  assert.equal((await adminAuth.requireAdmin("/admin")).role, "admin");
});

console.log("URL state: untrusted input is whitelisted");
await check("parseOrderFilters: junk becomes defaults; reversed dates swap; long text is cut; listHref omits defaults", () => {
  const f = filters.parseOrderFilters({ status: "__proto__", area: "mars", from: "2026-02-31", to: "x", sort: "password", dir: "sideways", page: "-4", q: "a".repeat(500) });
  assert.deepEqual([f.status, f.area, f.from, f.to, f.sort, f.dir, f.page], ["", "", "", "", "date", "desc", 1]);
  assert.equal(f.q.length, 60);
  f.q = "";
  const swapped = filters.parseOrderFilters({ from: "2026-10-20", to: "2026-10-10" });
  assert.deepEqual([swapped.from, swapped.to], ["2026-10-10", "2026-10-20"]);
  assert.equal(filters.listHref("/admin/orders", { ...f, status: "preparing", page: 3 }, filters.ORDER_DEFAULTS), "/admin/orders?status=preparing&page=3");
  assert.equal(filters.listHref("/admin/orders", f, filters.ORDER_DEFAULTS), "/admin/orders");
  assert.equal(filters.parseDishParams({ category: "nonsense" }).category, "All");
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("Failed: " + failures.join("; "));
  process.exit(1);
}
