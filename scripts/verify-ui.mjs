// Days 46–48 — logic-level checks for the data screens, run against the REAL modules
// (lib/format, lib/csv, lib/order-table, lib/stats, lib/orders, lib/tracking) and the REAL
// route handlers (session, SSE stream, CSV export). Only the framework edges (cookies(),
// redirect(), server-only) are stand-ins, as in verify-auth.mjs. No install, no server.
//
//   npm test
//
// This does NOT render React, run Recharts or Leaflet, or open a browser. Layout, the map,
// the charts and the keyboard pass still have to be checked on `npm run start`.
import { register } from "node:module";
import assert from "node:assert/strict";

process.env.NODE_ENV = "production";
process.env.SESSION_SECRET = "test-secret-at-least-16-chars";
process.env.STAFF_PHONES = "0922000000";
register("./stubs/hooks.mjs", import.meta.url);

const { jar } = await import("./stubs/next-headers.mjs");
const { Redirected } = await import("./stubs/next-navigation.mjs");
const session = await import("../lib/session.js");
const orders = await import("../lib/orders.js");
const actions = await import("../app/actions.js");
const format = await import("../lib/format.js");
const { csvCell, toCsv } = await import("../lib/csv.js");
const table = await import("../lib/order-table.js");
const stats = await import("../lib/stats.js");
const tracking = await import("../lib/tracking.js");
const { DELIVERY_AREAS } = await import("../lib/delivery.js");
const { demoMode } = await import("../lib/demo.js");
const { CART_COOKIE } = await import("../lib/cart.js");
const streamRoute = await import("../app/api/orders/[id]/stream/route.js");
const exportRoute = await import("../app/api/orders/export/route.js");
const sessionRoute = await import("../app/api/session/route.js");
const ordersRoute = await import("../app/api/orders/route.js");

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
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
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
async function signInAs(name, phone) {
  await redirectOf(() => actions.signIn(form({ name, phone, next: "/" })));
  return jar.values.get(session.SESSION_COOKIE);
}
const useToken = (token) => jar.values.set(session.SESSION_COOKIE, token);
async function place(token, area, address, items = [{ id: "doro-wot-deluxe", quantity: 1 }]) {
  useToken(token);
  jar.values.set(CART_COOKIE, JSON.stringify(items));
  const to = await redirectOf(() => actions.placeOrder({}, form({ name: "Test", phone: "0911234567", area, address })));
  return decodeURIComponent(to.split("=")[1]);
}
const plain = (s) => s.replace(/\u00a0|\u202f/g, " ");

console.log("lib/format.js — one module, locale and time zone named");
await check("etb: ETB 14,200 — no decimals, no hand-built 'birr'", () => {
  assert.equal(plain(format.etb.format(14200)), "ETB 14,200");
  assert.equal(plain(format.formatETB(1528)), "ETB 1,528");
  assert.equal(plain(format.formatETB(NaN)), "ETB 0");
});
await check("birr: a bare number for columns whose header names the unit", () => {
  assert.equal(format.birr.format(14200), "14,200");
});
await check("when: Addis Ababa time (UTC+3), whatever the server's own zone", () => {
  const text = plain(format.when.format(new Date("2026-07-14T15:40:00Z")));
  assert.match(text, /6:40\sPM/);
  assert.match(text, /Jul 14, 2026/);
});
await check("dayKey: 21:30 UTC is already the NEXT day in Addis Ababa", () => {
  assert.equal(format.dayKey(Date.parse("2026-10-13T21:30:00Z")), "2026-10-14");
  assert.equal(format.dayKey(Date.parse("2026-10-13T20:59:00Z")), "2026-10-13");
});
await check("relative: '12 minutes ago', 'in 2 hours', 'yesterday'", () => {
  const now = Date.parse("2026-10-13T12:00:00Z");
  assert.equal(format.relative(now - 12 * 60_000, now), "12 minutes ago");
  assert.equal(format.relative(now + 2 * 3_600_000, now), "in 2 hours");
  assert.equal(format.relative(now - 86_400_000, now), "yesterday");
});

console.log("lib/csv.js — the escaping is the whole problem");
await check("a restaurant called \"Bole, Kitfo\" stays ONE cell", () => {
  assert.equal(csvCell("Bole, Kitfo"), '"Bole, Kitfo"');
  assert.equal(toCsv(["a", "b"], [["Bole, Kitfo", 5]]), 'a,b\r\n"Bole, Kitfo",5\r\n');
});
await check("a quotation mark is doubled; a newline stays inside its cell", () => {
  assert.equal(csvCell('The "best" tibs'), '"The ""best"" tibs"');
  assert.equal(csvCell("line one\nline two"), '"line one\nline two"');
});
await check("a text cell starting = + - @ is neutralised (spreadsheet formula injection); numbers are not", () => {
  assert.equal(csvCell("=HYPERLINK(\"http://evil\")"), `"'=HYPERLINK(""http://evil"")"`);
  assert.equal(csvCell("+251911"), "'+251911");
  assert.equal(csvCell("@sum"), "'@sum");
  assert.equal(csvCell(-5), "-5");
  assert.equal(csvCell(null), "");
});
await check("round trip: a tiny RFC-4180 reader gets the awkward values back exactly", () => {
  const awkward = ['Bole, Kitfo', 'say "hi"', "two\nlines", "plain", ""];
  const text = toCsv(["x"], awkward.map((v) => [v]));
  const out = [];
  let cell = "";
  let quoted = false;
  let row = [];
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i += 1; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\r") { /* skip */ }
    else if (c === "\n") { row.push(cell); out.push(row); row = []; cell = ""; }
    else cell += c;
  }
  assert.deepEqual(out.slice(1).map((r) => r[0]), awkward);
});

console.log("lib/order-table.js — sort and page state lives in the URL");
await check("sort and dir are whitelisted; junk falls back to the defaults", () => {
  assert.equal(table.parseSort("total"), "total");
  assert.equal(table.parseSort("password; drop table"), "date");
  assert.equal(table.parseSort(["total", "id"]), "total");
  assert.equal(table.parseDir("asc"), "asc");
  assert.equal(table.parseDir("sideways"), "desc");
});
const rows = [
  { id: "AE-3", createdAt: 300, total: 100, status: "received" },
  { id: "AE-1", createdAt: 100, total: 900, status: "cancelled" },
  { id: "AE-2", createdAt: 200, total: 500, status: "on_the_way" },
];
await check("sortRows: total desc / asc, date desc, status order", () => {
  assert.deepEqual(table.sortRows(rows, "total", "desc").map((r) => r.id), ["AE-1", "AE-2", "AE-3"]);
  assert.deepEqual(table.sortRows(rows, "total", "asc").map((r) => r.id), ["AE-3", "AE-2", "AE-1"]);
  assert.deepEqual(table.sortRows(rows, "date", "desc").map((r) => r.id), ["AE-3", "AE-2", "AE-1"]);
  assert.deepEqual(table.sortRows(rows, "status", "asc").map((r) => r.id), ["AE-3", "AE-2", "AE-1"]);
});
await check("paginate: 25 rows → 3 pages of 10; an out-of-range page is clamped; junk is page 1", () => {
  const many = Array.from({ length: 25 }, (_, i) => ({ id: `AE-${i}`, createdAt: i, total: i, status: "received" }));
  const p3 = table.paginate(many, 3, 10);
  assert.equal(p3.rows.length, 5);
  assert.equal(p3.pages, 3);
  assert.equal(table.paginate(many, 99, 10).page, 3);
  assert.equal(table.paginate(many, -4, 10).page, 1);
  assert.equal(table.paginate(many, NaN, 10).page, 1);
  assert.equal(table.paginate([], 1, 10).pages, 1);
});
await check("tableHref: 'page three sorted by total' is a real, linkable URL; defaults are omitted", () => {
  assert.equal(table.tableHref("/orders", { sort: "total", dir: "desc", page: 3 }), "/orders?sort=total&dir=desc&page=3");
  assert.equal(table.tableHref("/orders", {}), "/orders");
  assert.equal(table.tableHref("/orders", { sort: "date", dir: "desc", page: 2 }), "/orders?page=2");
  assert.equal(table.tableHref("/dashboard", { sort: "status" }), "/dashboard?sort=status&dir=asc");
});
await check("pageWindow: all pages when few, ellipses when many", () => {
  assert.deepEqual(table.pageWindow(2, 5), [1, 2, 3, 4, 5]);
  assert.deepEqual(table.pageWindow(6, 12), [1, "…", 5, 6, 7, "…", 12]);
  assert.deepEqual(table.pageWindow(1, 12), [1, 2, "…", 12]);
});

console.log("lib/stats.js — aggregation: a handful of rows, never every order");
const now = Date.parse("2026-10-13T12:00:00Z");
const sample = [
  { area: "bole", total: 560, createdAt: now - 1000, cancelled: false },
  { area: "bole", total: 400, createdAt: now - 2000, cancelled: false },
  { area: "cmc", total: 900, createdAt: now - 5 * 86_400_000, cancelled: false },
  { area: "cmc", total: 9999, createdAt: now - 1000, cancelled: true },
];
await check("revenueByArea: five rows (every neighbourhood), cancelled orders excluded, zero kept", () => {
  const out = stats.revenueByArea(sample);
  assert.equal(out.length, DELIVERY_AREAS.length);
  assert.equal(out.find((r) => r.area === "Bole").revenue, 960);
  assert.equal(out.find((r) => r.area === "CMC").revenue, 900);
  assert.equal(out.find((r) => r.area === "Piassa").revenue, 0);
  assert.ok(out.every((r) => r.revenue >= 0), "a bar axis must be able to start at zero");
});
await check("ordersPerDay: 30 rows, quiet days are zeros, cancelled not counted, range stated", () => {
  const out = stats.ordersPerDay(sample, { days: 30, now });
  assert.equal(out.rows.length, 30);
  assert.equal(out.rows.at(-1).orders, 2);
  assert.equal(out.rows.reduce((n, r) => n + r.orders, 0), 3);
  assert.equal(out.rows.filter((r) => r.orders === 0).length, 28);
  assert.match(out.from, /Sep/);
  assert.match(out.to, /Oct/);
});
await check("totals: average is a whole birr; cancelled counted separately", () => {
  const t = stats.totals(sample);
  assert.deepEqual(t, { orders: 3, revenue: 1860, average: 620, cancelled: 1 });
});

console.log("lib/tracking.js + delivery areas — the map's numbers");
await check("every area centre is [lat, lng] inside Addis Ababa (a reversed pair lands in the ocean)", () => {
  for (const area of DELIVERY_AREAS) {
    assert.ok(tracking.isInAddis(area.center), `${area.id} ${area.center}`);
    assert.ok(tracking.isInAddis([area.center[0], area.center[1]]));
    assert.equal(tracking.isInAddis([area.center[1], area.center[0]]), false, `${area.id} reversed would still pass`);
  }
});
await check("rideProgress: 0 before the courier leaves, 1 at arrival, never outside 0..1", () => {
  assert.equal(tracking.rideProgress(0), 0);
  assert.equal(tracking.rideProgress(90), 0);
  assert.equal(tracking.rideProgress(150), 0.5);
  assert.equal(tracking.rideProgress(9999), 1);
  assert.deepEqual(tracking.lerpPosition([0, 0], [10, 20], 0.5), [5, 10]);
});

console.log("lib/orders.js — scoped rows, duplicate guard, tracking");
const almaz = await signInAs("Almaz Bekele", "0911234567");
const abel = await signInAs("Abel Tesfaye", "0912345678");
const staff = await signInAs("Sara Kitchen", "0922000000");
let almazId;
await check("a double tap (same cart, same address, twice) creates ONE order, not two", async () => {
  almazId = await place(almaz, "bole", "Bole Road, house 12");
  const again = await place(almaz, "bole", "Bole Road, house 12");
  assert.equal(again, almazId);
  useToken(almaz);
  assert.equal(orders.getOrdersFor(await session.getSession()).length, 1);
});
await check("a genuinely different order (other address) is still a new order", async () => {
  const other = await place(almaz, "bole", "A different building 7");
  assert.notEqual(other, almazId);
});
await check("the same cart from ANOTHER customer is not treated as a repeat", async () => {
  const theirs = await place(abel, "bole", "Bole Road, house 12");
  assert.notEqual(theirs, almazId);
});
await check("POST /api/orders: a repeat answers 200 with the same order, a new order 201", async () => {
  useToken(almaz);
  const body = { name: "Almaz Bekele", phone: "0911234567", area: "kazanchis", address: "Kazanchis block 4", items: [{ id: "awaze-beef-tibs", quantity: 1 }] };
  const send = () => ordersRoute.POST(new Request("http://x/api/orders", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }));
  const first = await send();
  const second = await send();
  assert.equal(first.status, 201);
  assert.equal(second.status, 200);
  assert.equal((await first.json()).order.id, (await second.json()).order.id);
});
await check("getOrderRowsFor: only the signed-in customer's rows, no owner id, no phone, no address", async () => {
  useToken(abel);
  const mine = orders.getOrderRowsFor(await session.getSession(), { sort: "date", dir: "desc", page: 1 });
  assert.equal(mine.total, 1);
  assert.deepEqual(Object.keys(mine.rows[0]).sort(), ["area", "createdAt", "customer", "id", "status", "total"]);
  assert.equal(orders.getOrderRowsFor(null).total, 0);
});
await check("sort/dir/page cannot change WHOSE orders come back", async () => {
  useToken(abel);
  const s = await session.getSession();
  for (const sort of ["date", "total", "id", "status"]) {
    const out = orders.getOrderRowsFor(s, { sort, dir: "asc", page: 99 });
    assert.ok(out.rows.every((r) => r.id !== almazId));
  }
});
await check("getAllOrderRows (dashboard): refused for a customer, allowed for staff", async () => {
  useToken(abel);
  assert.equal(orders.getAllOrderRows(await session.getSession()), null);
  assert.equal(orders.getAllOrderRows(null), null);
  useToken(staff);
  const all = orders.getAllOrderRows(await session.getSession());
  assert.ok(all.total >= 3);
});
await check("getTracking: received → at the kitchen; on the way → courier moves; cancelled → no courier", async () => {
  useToken(almaz);
  const order = orders.getOrderFor(almazId, await session.getSession());
  const t0 = order.createdAt;
  const a = orders.getTracking(order, t0 + 5_000);
  assert.equal(a.status, "received");
  assert.deepEqual(a.courier, [9.0105, 38.7613]);
  assert.equal(a.done, false);
  const mid = orders.getTracking(order, t0 + 150_000);
  assert.equal(mid.status, "on_the_way");
  assert.equal(mid.arrived, false);
  assert.notDeepEqual(mid.courier, a.courier);
  const end = orders.getTracking(order, t0 + 300_000);
  assert.equal(end.arrived, true);
  assert.equal(end.done, true);
  assert.ok(tracking.isInAddis(end.courier));
});

console.log("Route handlers");
await check("GET /api/session: signed out → { user: null }; signed in → name + role only", async () => {
  signedOut();
  assert.deepEqual(await (await sessionRoute.GET()).json(), { user: null });
  useToken(staff);
  const body = await (await sessionRoute.GET()).json();
  assert.deepEqual(body, { user: { name: "Sara Kitchen", role: "staff" } });
  assert.equal(JSON.stringify(body).includes("0922"), false, "the phone number must not leave");
});
await check("SSE stream: 401 signed out, 404 for someone else's order — before any stream opens", async () => {
  signedOut();
  assert.equal((await streamRoute.GET(new Request("http://x"), { params: { id: almazId } })).status, 401);
  useToken(abel);
  assert.equal((await streamRoute.GET(new Request("http://x"), { params: { id: almazId } })).status, 404);
});
await check("SSE stream: correct framing — 'data: ' + JSON + TWO newlines — as bytes, then it can be cancelled", async () => {
  useToken(almaz);
  const controller = new AbortController();
  const res = await streamRoute.GET(new Request("http://x", { signal: controller.signal }), { params: { id: almazId } });
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type"), /^text\/event-stream/);
  const reader = res.body.getReader();
  const first = await reader.read();
  assert.ok(first.value instanceof Uint8Array, "chunks must be bytes");
  assert.equal(new TextDecoder().decode(first.value), "retry: 1000\n\n");
  const second = await reader.read();
  const text = new TextDecoder().decode(second.value);
  assert.match(text, /^data: \{.*\}\n\n$/s);
  const payload = JSON.parse(text.slice(6));
  assert.equal(payload.id, almazId);
  assert.ok(["received", "preparing", "on_the_way"].includes(payload.status));
  await reader.cancel(); // the browser leaving: the server's timer must stop
});
await check("CSV export: 401 signed out; signed in → only my orders, BOM, awkward address survives", async () => {
  signedOut();
  assert.equal((await exportRoute.GET()).status, 401);
  useToken(almaz);
  await place(almaz, "piassa", 'Bole, Kitfo "House" =1+1');
  const res = await exportRoute.GET();
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type"), /^text\/csv/);
  assert.match(res.headers.get("content-disposition"), /attachment/);
  // Response.text() strips a leading BOM (that is what the fetch spec says), so look at
  // the raw bytes: EF BB BF is what makes Excel read the file as UTF-8.
  const bytes = new Uint8Array(await res.arrayBuffer());
  assert.deepEqual([...bytes.slice(0, 3)], [0xef, 0xbb, 0xbf], "no UTF-8 BOM");
  const text = new TextDecoder("utf-8", { ignoreBOM: false }).decode(bytes);
  assert.ok(text.startsWith("Order,"));
  assert.ok(text.includes(`"'Bole, Kitfo ""House"" =1+1"`) || text.includes(`"Bole, Kitfo ""House"" =1+1"`));
  assert.ok(!text.includes("AE-" + "00000"));
  useToken(abel);
  const abelText = await (await exportRoute.GET()).text();
  assert.ok(!abelText.includes(almazId), "another customer's order is in my export");
});

console.log("lib/demo.js");
await check("?demo= accepts only loading | empty | error", () => {
  assert.equal(demoMode({ demo: "error" }), "error");
  assert.equal(demoMode({ demo: "rm -rf" }), null);
  assert.equal(demoMode({}), null);
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("Failed:\n - " + failures.join("\n - "));
  process.exit(1);
}
