# DATA.md — every query: server or client, its key, its refresh rule, and why

Day 38's rule still holds: if a server component can fetch it, it does (the menu on `/menu/[id]`, the home page specials, the checkout page). SWR is used only for what stays in the browser — a poll, a search box, and later pages of a list. **Three client queries, one shared fetcher** (`lib/fetcher.js`, which throws a `FetchError` for any non-OK response so SWR sees it as `error`).

## Day 45 — where data is fetched (decision table 2)

| Data | Where, and why |
| --- | --- |
| Menu and dishes | **Server** — public, indexable, cacheable. `/menu` renders its first page on the server (and seeds SWR); `/menu/[id]` and the home specials are prerendered. |
| Order history | **Server** — private, scoped to the session (`getOrdersFor(session)` in `/orders`). |
| Order status | **Server first, then polled on the client** — the page arrives with the real status; `OrderStatus` polls `/api/orders/[id]`. |
| Menu search | **Client** — triggered by typing, debounced 300 ms. |
| Cart | **Client store** — localStorage; only `{ id, quantity }` is mirrored into a cookie scoped to `/checkout`. It never goes anywhere else. |

## Every server-side read

None of these is a client query: a server component or handler calls the function directly (no HTTP hop to ourselves). There is no key; `getDishes` is wrapped in React `cache()` so a render reads the file once.

| Read | Used by | Refresh rule | Why |
| --- | --- | --- | --- |
| `getDishes()` | `/` (specials), `/menu/[id]` params, `app/sitemap.js`, dish OG images, `GET /api/dishes` (no query) | Build time for static pages; every request for the API | Public data that changes a few times a day. |
| `getDishById(id)` | `/menu/[id]` page, its `generateMetadata`, its OG image | Prerendered per dish; unknown ids on demand → `notFound()` | Same read, deduped within a render. |
| `queryDishes({ q, category, page })` | `/menu` first paint, `GET /api/dishes?…` | Every request (`force-dynamic`) | Page and category live in the URL, so the server must read `searchParams`. |
| `getOrdersFor(session)` | `/orders` | Every request | Private; built from the session, no id from the request. |
| `getOrderFor(id, session)` | `/orders/[id]`, `/checkout?order=`, `GET /api/orders/[id]`, `GET /api/orders?id=` | Every request | Private; not-yours and not-found are the same answer. |
| `listAllOrders(session)` | `/kitchen` | Every request | Staff only; the role check lives in the function. |
| `priceLines(lines)` | `/checkout`, `placeOrder`, `createOrder` | Every request | Prices always come from our menu, never from the client. |

## Every client query (SWR)

| # | Query | Where | Key | First value | Refresh rule | Why |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Order status | `app/orders/OrderStatus.js` (used by `/orders/[id]` and the checkout confirmation) | `` `/api/orders/${id}` `` | `fallbackData: { order }` from the server component — no spinner | `refreshInterval`: **5000 ms** until the status is `on_the_way` or `cancelled`, then `0`. Focus/reconnect revalidation left at the defaults. | The kitchen moves an order roughly every 30–60 s, so 5 s feels live without hammering the server; a final status can never change again, so polling stops. Focus revalidation is wanted here: someone returning to the tab should see the current status at once. SWR pauses polling in a hidden tab (`refreshWhenHidden` is off). |
| 2 | Menu — browse a page | `app/menu/MenuBrowser.js` | `` `/api/dishes?category=…&page=N` `` (built by `dishesUrl`) | `fallbackData` from `/menu`'s server render, **only** for the key the server rendered | `keepPreviousData: true`, `revalidateIfStale: false`, `revalidateOnFocus: false` | The menu changes a few times a day, so a visited page needs no refetch and focus revalidation would be pure traffic. `keepPreviousData` holds the old page while the next one loads, so the grid never flashes empty. Page and category sit in the URL, so a page is linkable and shareable. |
| 3 | Menu — search | `app/menu/MenuBrowser.js` | `` `/api/dishes?q=…&category=…` `` — **`null` when the debounced term is empty** | none (nothing to show until the first answer; the browse list stays on screen meanwhile) | `keepPreviousData: true`, `revalidateOnFocus: false`; the term is debounced **300 ms** (`useDebounce`) | Debounce means typing "tibs" sends one request, not four. The `null` key means an empty box never searches for nothing. `keepPreviousData` keeps the last results visible between terms. The result on screen always matches the current key: SWR drops an old response that arrives after a newer key was requested, so the Day 29 race cannot occur. |

## Days 46–48 — what was added

**Server reads** (called directly, no HTTP hop): `getOrderRowsFor(session, {sort, dir, page})` (`/orders`), `getAllOrderRows` and `listAllOrders` (`/dashboard`, staff), `getExportRowsFor(session)` (CSV), `getTracking(order)` (order page and SSE stream). Aggregation (`lib/stats.js`) runs on the server: **the dashboard sends the browser 5 revenue rows and 30 daily rows — not every order — and the order table sends one page of 10 rows** (id, time, area, status, total, first name; no phone, no address).

**Client data:**

| # | Query | Where | Key | First value | Refresh rule | Why |
| --- | --- | --- | --- | --- | --- | --- |
| 4 | Header sign-in state | `components/SiteHeader.js` | `/api/session` | none (space reserved, no flash of the wrong state) | `revalidateOnFocus: false`; re-asked **after every route change** because the header lives in the layout and would otherwise still say "Sign out" after signing out | Keeps the layout cookie-free and therefore static. Returns name + role only. |
| 5 | Live order status | `app/orders/[id]/LiveTracking.js` | `EventSource('/api/orders/[id]/stream')` (not SWR) | `initial` from the server render | The server pushes every 3 s; it closes on `done` (cancelled, or courier arrived) and after 25 s (the browser reconnects after 1 s and the first message is the current state). Closed on unmount. | One-directional and frequent: SSE per the Day 47 table. WebSockets would need a separate service on serverless hosting. |
| 5b | …fallback | same | `/api/orders/[id]` (SWR key `null` unless the stream failed for good) | — | `refreshInterval: 5000` | If `EventSource` is missing or the server answers 401/404/500 instead of a stream, the page polls instead — and shows "Live updates paused". |

**Formats crossing boundaries:** dates are `Date.now()` numbers (UTC) in the store, ISO strings in `dateTime` attributes and the CSV, and are converted to Addis Ababa time only at display (`lib/format.js`: `etb`, `birr`, `when`, `whenDate`, `whenTime`, `relative`, `dayKey`). Money is whole birr integers. The CSV is built **on the server** (the table is paged, so the page does not hold the whole history), quotes commas/quotes/newlines, prefixes `'` to text starting `= + - @`, and starts with a UTF-8 BOM so Excel reads it correctly.

**Not queries:** the order table, sort and paging are links — the state lives in the URL (`?sort=total&dir=desc&page=3`), parsed against a whitelist in `lib/order-table.js`.

## Decisions worth knowing

- **String keys, not array keys.** The key is the URL, built by one function (`lib/paging.js › dishesUrl`) shared by the server render and the client hook, so the server's `fallbackData` is matched to exactly the key the client will compute. The sheet's array-key form (`["/api/dishes", category, page]`) works too; it would just need the fetcher to rebuild the URL.
- **`fallbackData` is key-specific on purpose.** `fallbackData` applies to whatever key the hook currently has, so `MenuBrowser` passes it only when the key equals the one the server rendered. Otherwise page 2 would briefly show page 1's data.
- **Search is unpaged, browsing is paged.** `GET /api/dishes` returns one page when `page` is present and every match when it is not. With no query at all it still returns the plain array it returned on Day 40.
- **Why SWR and not TanStack Query.** The client-side work is a poll and a search box — mostly reads — which is the sheet's stated case for SWR. There is no cart or order write that needs `invalidateQueries`; writes remain server actions.
- **Not queries.** The cart (localStorage), the session (httpOnly cookie) and the place-order / cancel writes (server actions) do not use SWR.

## Day 45 check list (verify with the tool, not by eye)

| Area | How to check | What you want | Status |
| --- | --- | --- | --- |
| Live data | Network tab, type "tibs" in the menu search | One `/api/dishes?q=tibs…` request per pause, not per keystroke | **Not verified** (needs a running build; the 300 ms debounce is in `useDebounce` and the `null` key in `MenuBrowser`) |
| Seeding | Load `/orders/<id>` with the Network tab throttled | The status text is in the first HTML; no spinner | **Not verified** (`fallbackData` is passed in `OrderStatus`) |
