# AUTH.md — who may see what, and the line that says no

Sign-in is a **mock**: a name and an Ethiopian mobile number, no password. There is nothing to protect an account with, so anyone who types a number is that customer. The authorisation machinery below is real; the identity behind it is not. Orders live in memory and reset on a restart.

> This file did not exist in the uploaded project (the README of Day 42 lists it). It was written on Day 49 from the code as it stands, and the line numbers below were read from that code.

## The session

`lib/session.js`: an HMAC-signed token `payload.signature` in an `httpOnly`, `secure` (production), `sameSite=lax`, `path=/` cookie, valid 8 hours. The payload holds `uid`, `name`, `phone`, `role`, `jti` and `exp` (the checkout form is pre-filled from it); it is signed, not encrypted, so it is readable by the person it belongs to and no one else's. **No password exists, and `/api/session` never returns the phone.** The role is decided by the server from `STAFF_PHONES`, never by the form (`roleForPhone`).

| Check | Where | What it proves |
| --- | --- | --- |
| Signature | `session.js:72` (`timingSafeEqual`) | The cookie was made by this server. |
| Expiry | `session.js:84` | It is younger than 8 h. |
| Revocation | `session.js:85` | The person has not signed out since (sign-out remembers the `jti`). |

## Layers

1. **Middleware** (`middleware.js`) — only checks a well-formed cookie *exists* and redirects to `/signin?next=…`. It proves nothing about who it is, which is why it is **not** the security check. Matcher: `/checkout`, `/orders`, `/kitchen`, `/dashboard`. `/api/*` is not matched; handlers answer JSON 401.
2. **The page** — `requireSession()` verifies the cookie for real while rendering (`session.js:101`). Staff pages then check `role` and answer `notFound()`.
3. **The data function** — every read and write takes the *session* and filters by its `uid` (`orders.js:115`, `:122`) or checks the role itself (`orders.js:188`). Pages and handlers cannot forget it, because the function will not answer without it.

## Every private route

| Route | Layer 1 | Layer 2 | Layer 3 (the data) |
| --- | --- | --- | --- |
| `/checkout` | middleware | `requireSession` | `placeOrder` re-checks `getSession()` (`actions.js:56`) and prices from our menu |
| `/orders` | middleware | `requireSession` | `getOrderRowsFor(session)` — **`?sort`, `?dir`, `?page` only reorder and window the session's own list** |
| `/orders/[id]` | middleware | `requireSession` | `getOrderFor(id, session)` → not yours = not found (`orders.js:115`) |
| `/kitchen` | middleware | `requireSession` + `role === "staff"` → `notFound()` | `listAllOrders(session)` returns `null` for non-staff (`orders.js:188`) |
| `/dashboard` (Day 46) | middleware | `requireSession` + `role === "staff"` → `notFound()` | `listAllOrders` / `getAllOrderRows` return `null` for non-staff; the charts get 5 and 30 summarised rows, never order records |
| `POST /api/orders` | — | — | `getSession()` → 401; `createOrder` validates and prices server-side |
| `GET /api/orders/[id]` | — | — | 401, then `getOrderFor` → 404 |
| `GET /api/orders/[id]/stream` (Day 47) | — | — | 401 and 404 are answered **before the stream is opened**; the stream only ever carries `getTracking(order)` |
| `GET /api/orders/export` (Day 47) | — | — | 401; rows from `getExportRowsFor(session)` — no id or filter in the request to tamper with |
| `GET /api/session` (Day 48) | — | — | Public on purpose: returns `{ user: null }` or `{ name, role }` — never the phone, `uid` or token. Used only to choose which header links to show; every route above still refuses on the server whether or not a link is shown |

Server actions: `placeOrder` (`actions.js:56`) and `cancelOrder` (`actions.js:85`) each call `getSession()` themselves and use the session-scoped functions. `?demo=` (Day 46) can only force a loading delay, an empty list or an error page; it runs after the session and role checks and never reveals or changes data.

## The three attacks (and the line that refused each)

| # | Attack | Refused by |
| --- | --- | --- |
| 1 | **Signed out**, call a write (`cancelOrder`, `placeOrder`) with a real order id | `cancelOrderFor(id, null)` returns the sign-in outcome — `actions.js:85–87`; `placeOrder` returns "sign in" at `actions.js:56`. Nothing is created or cancelled. |
| 2 | **Signed in as someone else**, use another customer's order id (page, API, stream, cancel) | `orders.js:115` — `order.ownerId === session.uid` or `null` → 404 / not-found. Tested for the page query, `getOrderFor`, cancel and the stream. |
| 3 | **Crafted return link** `/signin?next=https://example.com` | `lib/safe-next.js:9` (`safeNext`) rejects absolute URLs, `//host`, `/\host` and control characters; it runs on the sign-in page *and* again inside the `signIn` action (`actions.js:31–34`). |

**Tested at logic level, not in a browser:** `npm test` runs the real session, orders, actions and route-handler code with stand-ins for `cookies()` and `redirect()` — 17 checks in `scripts/verify-auth.mjs` and 32 in `scripts/verify-ui.mjs`, including: a customer gets `null` from `getAllOrderRows`, another customer's export and stream never contain your order, `/api/session` never contains the phone number. **Not yet done:** the three attacks typed into the console of a *deployed* site, and the changed-id-in-a-private-URL check in a real browser.

## Known limits (honest)

- No password: knowing a phone number is enough to be that customer. Fine for coursework; never for money.
- Orders, sessions' revocation list and the duplicate-order guard are **in memory**: a restart or a second server instance forgets them. A serverless host can run several instances, so on Vercel an order placed on one instance may not be visible on another. Module 5's database fixes this; until then the deployed demo is only reliable for a single instance.
- A stream already open keeps running for up to 25 s after sign-out (it closes itself at that point); the browser's reconnect is then refused with 401.
- The CSV export is formula-safe (`'` prefix) but not signed or time-limited — it is simply behind the session.
- The map's courier is simulated (`lib/tracking.js`); the OpenStreetMap public tile server is not for production traffic.
