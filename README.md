# Addis Eats — Next.js (Days 46–50: data screens, tracking, hardening, ship)

Days 46–48 add the staff **dashboard** (charts + an accessible, sortable, paged order table), the **delivery tracking** page (Leaflet map, live status over server-sent events, one shared format module, CSV export) and the **hardening pass** (keyboard, touch, double-submit, deploy checklist). On top of that the **cart, checkout and My orders screens were redesigned and made mobile-first**, and the header got an accessible hamburger menu. Day 49 is the documents (`README.md`, `AUTH.md`, `DATA.md`, `PERF.md`, `FUTURE.md`); Day 50 is assessment day and adds no code. Earlier days (41–45: SWR, middleware, sessions, metadata, optimisation) are unchanged except where listed below.

> **Read this first — what was and was not verified.** This was prepared in an environment with **no npm registry, no Next.js install and no deployment access**. `npm install`, `npm run lint`, `npm run build`, Lighthouse, a real phone and the Vercel deployment were **not done**. What *was* run is listed under "Claim → command" below. Recharts and Leaflet code was written against their documented APIs but **has never been executed**: look at `/dashboard` and an order page first.

## Run it

```bash
npm install          # NOT `npm ci`: package.json gained recharts, leaflet and react-leaflet, and package-lock.json
                     # could not be regenerated offline. `npm install` adds them and rewrites the lockfile — commit it.
cp .env.example .env.local     # SESSION_SECRET signs the cookie; STAFF_PHONES lists staff (they see Kitchen + Dashboard)
npm run check:env              # fails fast on a missing / example secret
npm test                       # logic tests + import/secret pre-flight (no install needed)
npm run lint && npm run build
npm run start                  # http://localhost:3000 — verify on this, not `npm run dev`
```

Node 18.18+. The uploaded zip had **no dotfiles**; `.env.example`, `.eslintrc.json` and `.gitignore` were re-created. If your real repository already has them, keep yours. `app/middleware.js` (a stray duplicate of the root `middleware.js`; Next.js only reads the root one) was left untouched — delete it if you agree it is dead. `AUTH.md` was also missing from the zip and was written (see its first lines).

**Try it:** sign in with any name and a number like `0911234567`; use `0922000000` (in `.env.example`'s `STAFF_PHONES`) for the staff account. Place an order, open it from **My orders**, and watch the status/courier move for ~3.5 minutes. Add `?demo=loading`, `?demo=empty` or `?demo=error` to `/orders` or `/dashboard` to force each state.

## Days 46–48 — what was built

**Dashboard (`/dashboard`, staff only)** — revenue by neighbourhood (bar, axis from zero, ETB ticks and value labels), orders per day for the last 30 days (line, zeros kept, range and "EAT" stated in the heading), each followed by the same numbers as a real table; then all orders in an accessible table. Aggregation is on the server (`lib/stats.js`): **5 + 30 summarised rows and one page of 10 orders reach the browser.** Cancelled orders are excluded from revenue and counts, and the page says so.

**Order tables (`components/OrderTable.js`, used by `/orders` and `/dashboard`)** — `table`, `caption`, `thead`, `th scope`, right-aligned tabular figures, `aria-sort` on the active header, sorting and paging as plain `Link`s to real URLs (`/orders?sort=total&dir=desc&page=3`), values validated against a whitelist. On a phone the date stacks over the time so the Total column is always visible; wider tables scroll in a labelled, focusable region.

**The four states** — loading: `loading.js` skeletons shaped like the page; empty: "No orders yet — browse the menu…" with a link; error: `error.js` with a retry button and no internal message; loaded. Each is forced on demand with `?demo=loading|empty|error` (`lib/demo.js`).

**Tracking (`/orders/[id]`)** — Leaflet map (`ssr: false`, stylesheet imported, explicit height, attribution kept, placeholder exactly the map's height), the same information as text beside it, and live status over SSE (`/api/orders/[id]/stream`: correct `data:` + two-newline framing, bytes not strings, 401/404 before any stream opens). The client `EventSource` is seeded from the server render, shows *Live / Reconnecting / Live updates paused / Tracking complete*, is closed on unmount and when the server says `done`, and falls back to polling if streaming fails. **The courier is simulated** (there is no courier app) and the pin marks the *approximate* neighbourhood centre; the page says both.

**Shared formatting (`lib/format.js`)** — `etb`, `birr`, `when`, `whenDate`, `whenTime`, `relative`, `dayKey`; each built once, locale `en-ET` and zone `Africa/Addis_Ababa` always named. `formatETB` remains as an alias, so prices now read "ETB 1,528" instead of "1,528 ETB" everywhere.

**CSV export (`GET /api/orders/export`, "Download CSV" on My orders)** — built on the server from the session's own orders; quotes commas, quotes and newlines; prefixes `'` to text starting `= + - @` (spreadsheet formula injection — names and addresses are typed by customers); UTF-8 BOM for Excel.

**Hardening (Day 48)** — no clickable divs or spans anywhere (scanned); focus ring never removed; every control ≥ 44×44 px on the screens that were measured (header, cart, checkout, My orders, dashboard table, tracking panel — **the menu page, category bar and dish detail were not measured**; `.btn` now has `min-height: 44px` globally, but check them); nothing hidden behind hover; forms use `onSubmit`/`action` with the button disabled while pending; **the server also treats an identical order from the same customer within 10 s as a repeat and returns the same order** (`createOrder`), so a double tap cannot create two (`POST /api/orders` answers 200 instead of 201 for that repeat); `prefers-reduced-motion` respected; `scroll-padding` so a focused control is not hidden under the sticky header or the mobile checkout bar.

## Cart, checkout, My orders, hamburger — what changed

- **Cart:** one responsive line layout (image · name/price/Remove · stepper · line total; stacks cleanly at ≤560 px), 44 px stepper, two-step "Clear cart", subtotal + the real delivery range from `lib/delivery.js`, a loading skeleton while the saved cart is read, an empty state with a link, and a sticky checkout bar on phones. Quantity is now capped at 50 in the cart (the server refuses more — previously that only failed at checkout).
- **Checkout:** summary first, then two labelled fieldsets (who / where); errors in text under the field; a notice when a dish in the cart is no longer on the menu (previously it was dropped silently); numeric keypad for the phone; the button shows the total and disables while placing. The order-submission logic and validation are unchanged — success is only ever shown after the order exists.
- **My orders:** the table above, count, CSV button, empty/loading/error states; each order opens a details + tracking page.
- **Header:** accessible hamburger (`aria-expanded`, `aria-controls`, label changes; Escape closes and returns focus; tap outside, link click or route change closes; keyboard operable). It is now sign-in-aware via `GET /api/session` — **Sign in** or name + **Sign out**, and **Kitchen / Dashboard** for staff — without making the layout dynamic. Fixed along the way: the hamburger bars were invisible (an undefined CSS variable), and Sign out buttons were hidden on phones with nothing replacing them.
- **Things you asked for that are not in the project:** the prompt mentions "the attached previous project" and a React/Vite app; only `next-eats.zip` (Next.js) and five PDFs were attached, so there was nothing else to compare. The five PDFs are Days 46–50; Day 50 contains no feature work.

## Claim → command (nothing here is "done" without its command)

| Claim | Command / check | Result |
| --- | --- | --- |
| Auth, scoping, the three attacks | `node scripts/verify-auth.mjs` (real session/orders/actions code) | **17 passed, 0 failed** |
| Formatting, CSV escaping, sort/paging, aggregation, tracking maths, duplicate-order guard, session / SSE / export route handlers | `node scripts/verify-ui.mjs` (real lib + route-handler code) | **32 passed, 0 failed** |
| Imports resolve with exact case; no secret is `NEXT_PUBLIC_`; image hosts allowed | `npm run check:imports` | **OK — 214 imports in 89 files** |
| Every JS/JSX file parses | TypeScript transpile of all files (not shipped) | **0 syntax problems** |
| No clickable div/span, no `outline: none` | `grep` over `app/` and `components/` | None found |
| Cart, checkout form, order tables, header, tracking panel at 360 / 768 / 1280 px: no horizontal overflow, every control ≥ 44×44, no page errors; hamburger, Escape, outside-tap, keyboard, auth-aware links; stepper cap, clear-cart confirm, validation messages | Real components bundled and driven in headless Chromium with stand-ins for `next/*`, SWR, charts and the map (harness not shipped) | **98 passed, 0 failed** |
| **Not run:** `npm install`, `npm run lint`, `npm run build`, the route table, `npm run start` | — | **Not run** (no registry) |
| **Not run:** Recharts charts and the Leaflet map actually rendering; the SSE stream through a real server | — | **Not verified** — the chart/map code and `LiveTracking` are unexecuted; the stream *handler* was exercised directly |
| **Not run:** Lighthouse, LCP/CLS/INP, real-phone pass, keyboard pass on the running app | — | **Not measured** (`PERF.md`) |
| **Not run:** Vercel deployment, post-deployment checks in a private window, shared-link card | — | **Not done — there is no live URL** |

## Deploy (do this next — the sheet's steps)

1. `npm install && npm run lint && npm run build && npm run start`; read the route table against `STRATEGY.md` (`/dashboard`, `/orders*`, `/api/session`, `/api/orders/*` should be `ƒ`; `/`, `/cart`, `/menu/[id]` should stay `○`/`●`).
2. Push to GitHub, import into Vercel, then add variables **per environment**:

| Variable | Development | Preview | Production |
| --- | --- | --- | --- |
| `SESSION_SECRET` | anything ≥ 16 chars | a different value | strong and unique |
| `STAFF_PHONES` | `0922000000` | test numbers | the real staff numbers |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` | the preview URL | the live domain (baked in at build — changing it needs a redeploy) |

3. Pre-flight already worked through here: imports are case-correct, no secret is `NEXT_PUBLIC_`, image hosts are allowed (the menu uses local files), `.env.example` lists every variable. Still to do on the deployment: `metadataBase` check by viewing source, previews as a card, `/sitemap.xml` and `/robots.txt`, Lighthouse (throttled) for `PERF.md`, and the three attacks in the console of the live site.
4. **Know the limit before you demo it:** orders live in memory, and serverless hosting may run several instances, so an order can appear to vanish between requests (`AUTH.md › Known limits`). The SSE stream also closes itself every 25 s and reconnects by design.
5. Rollback: Vercel → Deployments → the previous one → *Promote to Production*. Restore service first, then diagnose.
6. Put the live URL here: **Live URL: _none yet_**.

## Routes

| Route | Rendering | What it does |
| --- | --- | --- |
| `/` | Static | Landing page with today's specials |
| `/menu` | Dynamic | Paged dishes (`?page=2&category=Pizza`, 6 per page), debounced search via SWR. Was ISR on Day 40; see `STRATEGY.md` |
| `/orders/[id]` | Dynamic | **Private.** One order rendered on the server, then live status over SSE (polling fallback) and a Leaflet map; someone else's order → not-found |
| `/dashboard` | Dynamic | **New (Day 46), staff only.** Revenue and orders-per-day charts with tables, all orders sortable and paged; non-staff get not-found |
| `/api/session` | Dynamic | **New.** `{ user: null }` or `{ name, role }` for the header |
| `/api/orders/[id]/stream` | Dynamic | **New.** Server-sent events; 401 / 404 before the stream opens |
| `/api/orders/export` | Dynamic | **New.** The signed-in customer's orders as CSV |
| `/menu/[id]` | Static via params | One dish, quantity, add to cart; unknown id → `not-found` |
| `/cart` | Client | Order lines and the running ETB total |
| `/signin` | Dynamic | **New (Day 42).** Name + mobile number; `?next=` is validated and honoured after sign-in |
| `/checkout` | Dynamic | **Private.** Middleware + page check → validated form → `placeOrder` action → confirmation with live status |
| `/orders` | Dynamic | **Private.** The signed-in customer's orders: sortable, paged, with CSV export and the four states |
| `/kitchen` | Dynamic | **New, staff only.** All orders; non-staff get the not-found page |
| `/api/dishes`, `/api/dishes/[id]` | Dynamic | Dish JSON. `/api/dishes` takes `?q=`, `?category=`, `?page=` (no query → the whole array, as before); unknown id → `404 {"error": …}` |
| `/api/orders` | Dynamic | `POST` places an order (422/401/201), `GET ?id=` status |
| `/api/orders/[id]` | Dynamic | **New.** `GET` one order's status (401 / 404 / 200) — the SWR key |

See `STRATEGY.md` for the reasoning behind every marker, `BOUNDARY.md` for every client component and `DATA.md` for every query, key and refresh rule.

## Folder tree

```
app/
  layout.js  page.js  not-found.js  actions.js
  menu/    layout.js  page.js  MenuBrowser.js  loading.js  error.js   [id]/page.js
  orders/  OrderStatus.js   [id]/page.js
  cart/    page.js        checkout/  page.js
  signin/  page.js  SignInPanel.js     orders/  page.js   kitchen/  page.js
middleware.js   redirects signed-out visitors from /checkout, /orders, /kitchen
  api/dishes/route.js   api/dishes/[id]/route.js   api/orders/route.js   api/orders/[id]/route.js
components/   shared components      lib/   shared logic (validation, session, orders, dishes, fetcher, paging)
data/menu-data.json   the menu
```

`api/dishes/[id]/route.js` is the one file beyond the sheet's tree: the sheet's `curl localhost:3000/api/dishes/not-a-dish` check needs it to answer a JSON 404.

**Files added on Days 46–48:** `app/dashboard/{page,RevenueChart,OrdersChart,loading,error}.js` + `dashboard.css`; `app/orders/{loading,error}.js`; `app/orders/[id]/{LiveTracking,MapPanel,DeliveryMap}.js`; `app/api/session`, `app/api/orders/export`, `app/api/orders/[id]/stream`; `components/{OrderTable,TableSkeleton,QuantityStepper}.js` + css; `lib/{csv,stats,order-table,tracking,demo}.js`; `scripts/{verify-ui,check-imports}.mjs`; `FUTURE.md`, `AUTH.md`. Rewritten: `lib/format.js`, `app/cart/*`, `app/checkout/*`, `app/orders/*`, `components/SiteHeader.js`. Extended: `lib/orders.js`, `lib/delivery.js`, `components/Providers.js`, `middleware.js`, `app/robots.js`.

## Day 42 — what changed

- `middleware.js` — narrow matcher (`/checkout`, `/orders`, `/kitchen`); redirects to `/signin?next=…` when no well-formed session cookie exists.
- `lib/session.js` — `getSession()` (now async, used by every page, action and handler), `requireSession()`; session cookie `httpOnly` + `secure` (production) + `sameSite=lax`; signed token now carries `role`, `jti` and `exp`; sign-out revokes it on the server.
- `lib/safe-next.js` — `next` validation (rejects absolute URLs, `//host`, `/\host`, control characters); used by the sign-in page and the `signIn` action.
- `/signin` is its own route (the checkout page no longer renders a sign-in panel); sign-out now returns to `/`.
- `/orders` (list scoped to the session) and `/kitchen` (staff role, refused on the server); `lib/orders.js` gained `getOrdersFor` and `listAllOrders` (checks the role itself).
- `AUTH.md` — every protected route, its layers, what each proves, the three attacks, known limits.
- Added beyond the sheet's file list: `/orders` list page and the confirmation's "All my orders" / staff "Kitchen" links, so the protected routes are reachable.
- **Not changed:** sign-in still has no password (see `AUTH.md › Known limits`).

## Day 41 — what changed

- `lib/fetcher.js` — the one fetcher for every query; throws `FetchError` on non-OK responses.
- `app/orders/OrderStatus.js` — `useSWR` with `fallbackData` from the server and `refreshInterval: 5000`. `OrderTracker` lost its `setInterval`, abort controller, cleanup and state; it only clears the browser cart now.
- `app/orders/[id]/page.js` + `app/api/orders/[id]/route.js` — the order-status route and its SWR key. The checkout confirmation links to it (a small addition so the route is reachable).
- `app/menu/MenuBrowser.js` replaces `MenuFilter.js`: debounced search (null key when empty, `keepPreviousData`) and paging with the page in the query string.
- `GET /api/dishes` accepts `q`, `category`, `page`; `lib/dishes.js › queryDishes` is shared by it and the `/menu` server render.
- `/menu` and `/api/dishes` are now dynamic (they read the query string) — the one behavioural trade-off, written up in `STRATEGY.md`.

## Network tab while typing

**Expected, not yet observed** — this was written in an environment where the app could not be installed or run, so watch it yourself on `npm run start` (DevTools → Network → Fetch/XHR):

- Typing `tibs` quickly sends **one** request, `/api/dishes?q=tibs`, about 300 ms after the last key — not four.
- Clearing the box sends **none**: the key is `null`, and the paged list returns immediately.
- Typing `tib`, pausing, then `tibs` sends two requests; the list keeps `tib`'s results (dimmed, “updating…”) until `tibs` arrives and never shows an empty grid in between.
- Clicking Next sends one `/api/dishes?page=2` request and the URL becomes `/menu?page=2`; the first page loaded on arrival sends no `/api/dishes` request at all (it was server-rendered). Coming back to a visited page sends none (`revalidateIfStale: false`).
- On an order page, `/api/orders/AE-…` repeats every 5 s until the order is on its way or cancelled.

## Carried over from Day 35

Cart logic (add / update / remove / persist), the validation rules, the accessible `Field` markup with touched tracking, delivery fee and ETA, ETB formatting, the sign-in guard, all CSS, and the menu data. Not part of the Day 40 brief and therefore not rebuilt: favorites, order history, admin area, theme toggle.

## Design notes

- **Data movement.** Menu and dish data are read directly by server components (`lib/dishes.js`). Nothing in the app calls `/api/dishes`; it exists for outside consumers. The order write is a server action. The status poll is a route handler because it is repeated and browser-triggered.
- **Cart.** Source of truth is the browser (localStorage). `{ id, quantity }` is mirrored to a cookie with `Path=/checkout`, which is what lets checkout work with JavaScript disabled. The server re-prices every line from its own menu.
- **Guard and authorisation.** Mock sign-in (name + Ethiopian mobile) sets an `httpOnly`, HMAC-signed cookie. `placeOrder`, `cancelOrder` and `/api/orders` all check the session themselves; an order is only returned or cancelled for the session that owns it. Orders live in memory, so they reset when the server restarts.
- **One schema.** `lib/validate.js` is used by the form, the action and the route handler.

## Verify (run on the production build)

```bash
curl -i localhost:3000/api/dishes/not-a-dish          # 404 + {"error": …}
curl -i -X POST localhost:3000/api/orders -H "Content-Type: application/json" \
  -d '{"name":"Almaz","phone":"0912"}'                # 422 + fieldErrors.phone
curl -i localhost:3000/api/orders?id=AE-00000         # 401 without a session
```

Day 42 attack checks (see `AUTH.md`): in the console, post to a server action with no cookie; sign in as two phone numbers and cancel one account's order from the other; open `/signin?next=https://evil.example` and `/signin?next=//evil.example`, sign in, and confirm you land on `/`; confirm `/kitchen` is the not-found page unless your phone is in `STAFF_PHONES`; confirm the session cookie shows `HttpOnly`, `Secure`, `SameSite=Lax` in DevTools and `document.cookie` does not contain it; search `.next/static` for the secret.

Day 41 checks: `curl -i localhost:3000/api/orders/AE-00000` → 401 without a session; `curl 'localhost:3000/api/dishes?q=tibs'` → `{items…}`; `curl 'localhost:3000/api/dishes?page=2'` → items 7–12.

Browser checks: Slow 3G shows `loading.js`; throw inside `app/menu/page.js` to see `error.js` with header and cart intact; `/menu/not-a-dish` shows `not-found`; an invalid phone shows the message beside the field; with JavaScript disabled the checkout still places the order; search `.next/static` for the secret.

## Build output

**Not captured.** Days 41 and 42 were written in an environment where the npm registry was blocked, so `npm install`, `npm run lint` and `npm run build` could not be run (Day 42's logic was checked with stand-ins for the Next.js modules; see `AUTH.md`). Run them and paste the route table here; compare it against `STRATEGY.md`. Expected markers: `○ /`, `ƒ /menu`, `● /menu/[id]`, `○ /cart`, `ƒ /checkout`, `ƒ /signin`, `ƒ /orders`, `ƒ /orders/[id]`, `ƒ /kitchen`, `ƒ /api/dishes`, `ƒ /api/orders`, `ƒ /api/orders/[id]`, plus the `Middleware` size line.

## Day 43 — Optimisation & Environment

- **Images:** all photos go through `next/image` via `components/FoodImage.js` (width/height/sizes/alt on every call site). `priority` is used on the home hero only. Remote hosts are listed in `next.config.mjs`.
- **Fonts:** Manrope and Inter via `next/font/google` in `app/layout.js` (CSS variables `--font-manrope`, `--font-inter`); the Google `<link>` tags are gone.
- **Scripts:** the app has no third-party scripts; use `next/script` with `lazyOnload` if one is added.
- **Environment:** copy `.env.example` to `.env.local`; `.env*.local` is gitignored; `npm run check:env` validates it. `SESSION_SECRET` and `STAFF_PHONES` are server-only.
- **Config:** `next.config.mjs` replaces `next.config.js` (images, redirects, headers).
- **Measurement:** see `PERF.md` (numbers still to be recorded; none were measured when this was written).

Day 43 build output: **not captured** (see `PERF.md`).

## Day 44 — Metadata & SEO

`metadataBase`, title template, per-route descriptions, `generateMetadata` for dishes, generated Open Graph images (`app/opengraph-image.jsx`, `app/menu/[id]/opengraph-image.jsx`), `MenuItem` JSON-LD, `app/sitemap.js`, `app/robots.js` and canonical URLs. See `SEO.md`. Set `NEXT_PUBLIC_SITE_URL` to the deployed origin (default `https://addiseats.et`).

Day 44 build output: **not captured** (the npm registry was blocked; see `SEO.md`).

## Day 45 — Next.js advanced project (capstone integration)

Day 45 adds no new feature area; it brings Days 41–44 to the sheet's standard and writes the evidence down.

**Changes in this step:** a **My orders** link in the header (static; middleware sends signed-out visitors through `/signin`), **Sign out** buttons on `/orders` and `/kitchen`, `npm test` (`scripts/verify-auth.mjs`: the three attacks and more, run against the real session/orders/actions code), the five largest dish photos re-encoded under 150 kB, and the three documents rewritten to the sheet's format: `AUTH.md` (who may see what, layers per route, every action, the three attacks and the line that refused each), `DATA.md` (where data is fetched, every server read, every client query) and `PERF.md` (the budget table).

**Deployed URL: none.** This project has not been deployed (no network access where it was prepared), so there is no working URL to put here. The sheet's checks that only mean something on a deployment — absolute `og:image` URLs, a shared link rendering as a card, Lighthouse on the deployed build, cookie `Secure` over HTTPS — are therefore **not done**. On the host set `SESSION_SECRET`, `STAFF_PHONES` and `NEXT_PUBLIC_SITE_URL` (the real origin) before deploying; see `.env.example`.

### Claim → command (nothing here is "done" without its command)

| Claim | Command / check | Result when this was written |
| --- | --- | --- |
| Three attacks fail, and the refusing line is known | `npm test` → `AUTH.md` table | **17 passed, 0 failed** (logic level, Node 22) |
| Cookie flags `HttpOnly`, `Secure`, `SameSite=Lax` | `npm test` (flags passed to `cookies().set`); DevTools → Application → Cookies on a deployed HTTPS site | Test passed; browser check **not done** |
| Queries scoped to the session | `npm test` (`getOrdersFor`, `getOrderFor`) | Passed |
| Debounced search: one request per pause | Network tab while typing in `/menu` | **Not verified** |
| Order page seeded, no spinner | View source / throttled load of `/orders/<id>` | **Not verified** |
| Performance budget | Lighthouse (throttled) + `npm run build` route table | **Not measured** — only the largest-image row has numbers (`PERF.md`) |
| Metadata, previews, sitemap, robots | `SEO.md` verification commands; a social debugger on the deployed URL | **Not verified** |
| Lint and production build | `npm install && npm run lint && npm run build` | **Not run** (npm registry unreachable) |

Day 45 build output: **not captured**.
