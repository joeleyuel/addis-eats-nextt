// Day 45 — runs the three attacks (and a few more) against the REAL code:
// lib/session.js, lib/orders.js, lib/safe-next.js and the server actions in
// app/actions.js. Only the framework edges (cookies(), redirect(), server-only,
// react's cache) are replaced by stand-ins in scripts/stubs/, so this needs no
// `npm install` and no running server.
//
//   npm test            (Node 18.19+ / 20.6+, from the project root)
//
// This is a LOGIC-level check. It does not exercise Next.js itself, the edge-runtime
// middleware, HTTPS cookies in a browser, or a deployed site: repeat the attacks
// there too (see AUTH.md).
import { register } from "node:module";
import assert from "node:assert/strict";

process.env.NODE_ENV = "production";
process.env.SESSION_SECRET = "test-secret-at-least-16-chars";
process.env.STAFF_PHONES = "0922000000";
register("./stubs/hooks.mjs", import.meta.url);

const { jar } = await import("./stubs/next-headers.mjs");
const { Redirected, NotFound } = await import("./stubs/next-navigation.mjs");
const session = await import("../lib/session.js");
const orders = await import("../lib/orders.js");
const { safeNext } = await import("../lib/safe-next.js");
const { looksLikeSessionToken } = await import("../lib/session-cookie.js");
const actions = await import("../app/actions.js");
const { CART_COOKIE } = await import("../lib/cart.js");

let passed = 0;
const failures = [];
async function check(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`  ok   ${name}`);
  } catch (error) {
    failures.push(name);
    console.log(`  FAIL ${name}\n       ${error.message.split("\n")[0]}`);
  }
}

const form = (fields) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
};
// Run an action and report where it redirected (the real redirect() throws).
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
const useToken = (token) => jar.values.set(session.SESSION_COOKIE, token);
async function signInAs(name, phone, extra = {}) {
  await redirectOf(() => actions.signIn(form({ name, phone, next: "/", ...extra })));
  return jar.values.get(session.SESSION_COOKIE);
}

const ALMAZ = { name: "Almaz Bekele", phone: "0911234567" };
const ABEL = { name: "Abel Tesfaye", phone: "0912345678" };
const STAFF = { name: "Sara Kitchen", phone: "0922000000" };

console.log("Accounts: sign in, cookie flags, sign out");
let almazToken;
await check("sign-in sets the session cookie: httpOnly, secure, sameSite=lax, path=/, 8 h", async () => {
  almazToken = await signInAs(ALMAZ.name, ALMAZ.phone);
  const write = jar.writes.filter((w) => w.name === session.SESSION_COOKIE).at(-1);
  assert.ok(almazToken, "no cookie set");
  assert.equal(write.options.httpOnly, true);
  assert.equal(write.options.secure, true);
  assert.equal(write.options.sameSite, "lax");
  assert.equal(write.options.path, "/");
  assert.equal(write.options.maxAge, 60 * 60 * 8);
});
await check("the cookie value is a signed token that middleware's shape check accepts", () => {
  assert.equal(looksLikeSessionToken(almazToken), true);
  assert.equal(looksLikeSessionToken("abc"), false);
  assert.equal(looksLikeSessionToken(undefined), false);
});
await check("the session carries no password and the role is server-decided (form role=staff ignored)", async () => {
  const token = await signInAs(ABEL.name, ABEL.phone, { role: "staff" });
  const claims = session.readSessionToken(token);
  assert.equal(claims.role, "customer");
  assert.equal(JSON.stringify(claims).includes("password"), false);
});
await check("sign-out clears the cookie AND revokes the token (replaying the old cookie fails)", async () => {
  const token = await signInAs(ABEL.name, ABEL.phone);
  assert.ok(session.readSessionToken(token));
  const to = await redirectOf(() => actions.signOut());
  assert.equal(to, "/");
  assert.equal(jar.values.has(session.SESSION_COOKIE), false);
  assert.equal(session.readSessionToken(token), null);
});

console.log("Ownership: scoped queries");
let almazOrderId;
await check("placeOrder (signed in) creates an order owned by the session and redirects to it", async () => {
  useToken(almazToken);
  jar.values.set(CART_COOKIE, JSON.stringify([{ id: "doro-wot-deluxe", quantity: 2 }]));
  const to = await redirectOf(() =>
    actions.placeOrder({}, form({ name: ALMAZ.name, phone: ALMAZ.phone, area: "bole", address: "Bole Road, house 12" }))
  );
  assert.match(to, /^\/checkout\?order=AE-\d{5}$/);
  almazOrderId = decodeURIComponent(to.split("=")[1]);
  const mine = orders.getOrdersFor(await session.getSession());
  assert.equal(mine.length, 1);
  assert.equal(mine[0].items[0].price, 480, "the price must come from our menu");
});
await check("placeOrder signed out: refused, nothing created", async () => {
  const almaz = session.readSessionToken(almazToken);
  const countBefore = orders.getOrdersFor(almaz).length;
  signedOut();
  jar.values.set(CART_COOKIE, JSON.stringify([{ id: "doro-wot-deluxe", quantity: 1 }]));
  const result = await actions.placeOrder({}, form({ name: ALMAZ.name, phone: ALMAZ.phone, area: "bole", address: "Somewhere 1" }));
  assert.match(result.message, /sign in/i);
  assert.equal(orders.getOrdersFor(almaz).length, countBefore, "an order was created while signed out");
});
await check("getOrdersFor takes the session only: another account sees none of Almaz's orders", async () => {
  useToken(await signInAs(ABEL.name, ABEL.phone));
  assert.deepEqual(orders.getOrdersFor(await session.getSession()), []);
  assert.deepEqual(orders.getOrdersFor(null), []);
});
await check("getOrderFor with Almaz's id from Abel's session → null (the /orders/[id] and /api/orders/[id] 404)", async () => {
  assert.equal(orders.getOrderFor(almazOrderId, await session.getSession()), null);
  assert.equal(orders.getOrderFor(almazOrderId, null), null);
});
await check("toPublicOrder never leaks the owner id", async () => {
  useToken(almazToken);
  const order = orders.getOrderFor(almazOrderId, await session.getSession());
  assert.equal("ownerId" in orders.toPublicOrder(order), false);
});

console.log("The three attacks");
await check("ATTACK 1 — cancelOrder while signed out: refused (→ /signin), order untouched", async () => {
  signedOut();
  const to = await redirectOf(() => actions.cancelOrder(form({ orderId: almazOrderId })));
  assert.equal(to, "/signin?next=%2Forders");
  useToken(almazToken);
  assert.equal(orders.getOrderFor(almazOrderId, await session.getSession()).cancelled, false);
  assert.equal(orders.cancelOrderFor(almazOrderId, null).status, 401);
});
await check("ATTACK 2 — cancelOrder with another account's id: refused on ownership (→ /orders), order untouched", async () => {
  useToken(await signInAs(ABEL.name, ABEL.phone));
  const to = await redirectOf(() => actions.cancelOrder(form({ orderId: almazOrderId })));
  assert.equal(to, "/orders");
  assert.equal(orders.cancelOrderFor(almazOrderId, await session.getSession()).status, 404);
  useToken(almazToken);
  assert.equal(orders.getOrderFor(almazOrderId, await session.getSession()).cancelled, false);
});
await check("ATTACK 3 — crafted sign-in links never leave the site (safeNext)", () => {
  for (const evil of [
    "https://example.com",
    "//example.com",
    "/\\example.com",
    "/\t/example.com",
    "javascript:alert(1)",
    "http://example.com/orders",
    "",
    undefined,
  ]) {
    assert.equal(safeNext(evil), "/", `safeNext(${JSON.stringify(evil)})`);
  }
  assert.equal(safeNext("/orders"), "/orders");
  assert.equal(safeNext("/checkout?order=AE-12345"), "/checkout?order=AE-12345");
});
await check("ATTACK 3 — the signIn ACTION validates next again (not only the page)", async () => {
  signedOut();
  for (const evil of ["https://example.com", "//example.com", "/\\example.com"]) {
    const to = await redirectOf(() => actions.signIn(form({ ...ALMAZ, next: evil })));
    assert.equal(to, "/", `next=${evil}`);
  }
  assert.equal(await redirectOf(() => actions.signIn(form({ ...ALMAZ, next: "/orders" }))), "/orders");
});
await check("the owner CAN cancel their own order (the guard is not simply refusing everything)", async () => {
  useToken(almazToken);
  const to = await redirectOf(() => actions.cancelOrder(form({ orderId: almazOrderId })));
  assert.match(to, /^\/checkout\?order=/);
  assert.equal(orders.getOrderFor(almazOrderId, await session.getSession()).cancelled, true);
});

console.log("Protection: tokens and roles");
await check("a token with a forged role (payload edited, old signature kept) is rejected", () => {
  const [payload, signature] = almazToken.split(".");
  const claims = JSON.parse(Buffer.from(payload, "base64url").toString());
  claims.role = "staff";
  const forged = `${Buffer.from(JSON.stringify(claims)).toString("base64url")}.${signature}`;
  assert.equal(looksLikeSessionToken(forged), true, "layer 1 only checks the shape, so it passes");
  assert.equal(session.readSessionToken(forged), null, "layer 2 verifies the signature");
});
await check("an expired token is rejected", () => {
  const old = session.createSessionToken(ALMAZ, Date.now() - 9 * 60 * 60 * 1000);
  assert.equal(session.readSessionToken(old), null);
});
await check("/kitchen data: customers get null, staff get the list (listAllOrders)", async () => {
  useToken(almazToken);
  assert.equal(orders.listAllOrders(await session.getSession()), null);
  assert.equal(orders.listAllOrders(null), null);
  useToken(await signInAs(STAFF.name, STAFF.phone));
  const staff = await session.getSession();
  assert.equal(staff.role, "staff");
  assert.ok(Array.isArray(orders.listAllOrders(staff)));
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("Failed: " + failures.join("; "));
  process.exit(1);
}
