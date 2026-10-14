# STRATEGY.md — rendering strategy, one line per route

Questions asked of every route: *Who is asking? How stale may it be? Do I know the ids? Does it read a cookie? Is it private to one tab?*

| Route | Marker | Strategy | Why |
| --- | --- | --- | --- |
| `/` | static | `○` Static | Nobody in particular is asking and today's specials are a curated id list, so one build-time render serves everyone. |
| `/menu` | dynamic | `ƒ` (`force-dynamic`) | **Changed on Day 41** (was ISR, `○` + `revalidate = 3600`). The page number lives in the query string (`?page=2&category=Pizza`) so a page is linkable and indexable; the server must read `searchParams` to render that first view with real data (passed to SWR as `fallbackData`). The price is the hourly cache — the menu file is a cheap read. |
| `/menu/[id]` | static via params | `●` `generateStaticParams` | Every dish id is known at build time, so each dish is prerendered; an unknown id is rendered on demand and ends in `notFound()`. |
| `/cart` | client | `○` shell + client store | The cart is private to this browser (localStorage), so the server can only ship an empty shell; `CartView` fills it in after hydration. |
| `/checkout` | dynamic | `ƒ` (`force-dynamic`) | It reads the session cookie and the cart cookie, and a per-customer page must never be served from a shared cache. Signed-out visitors are redirected to `/signin` (Day 42; the in-page sign-in panel moved there). |
| `/api/dishes` | dynamic | `ƒ` (`force-dynamic`) | **Changed on Day 41** (was `○` + `revalidate = 3600`). It now reads `?q=`, `?category=` and `?page=`, which SWR requests. With no query it still returns the whole menu array. |
| `/api/dishes/[id]` | dynamic | `ƒ` | Ids are not enumerated, and an unknown id must answer a JSON 404. |
| `/api/orders` | dynamic | `ƒ` | Reads the session cookie; POST writes. |
| `/api/orders/[id]` | dynamic | `ƒ` | **New on Day 41.** The SWR key for order status. Reads the session cookie; someone else's order is a 404. |
| `/signin` | dynamic | `ƒ` (`force-dynamic`) | **New on Day 42.** Reads the session cookie (already signed in → leave) and `?next=`. |
| `/orders` | dynamic | `ƒ` (`force-dynamic`) | **New on Day 42.** One customer's order list, built from the session. |
| `/kitchen` | dynamic | `ƒ` (`force-dynamic`) | **New on Day 42.** Staff only; reads the session cookie. |
| `/orders/[id]` | dynamic | `ƒ` (`force-dynamic`) | **New on Day 41.** Reads the session cookie and shows one customer's order. Rendered complete on the server; **Day 47:** the status then streams over SSE (seeded from this render, polling fallback — see `DATA.md`) and a Leaflet map loads client-side only. |
| `/dashboard` | dynamic | `ƒ` (`force-dynamic`) | **New on Day 46.** Staff only. Reads the session cookie and `searchParams` (`?sort`, `?dir`, `?page`, `?demo`); the numbers change with every order. Aggregation on the server; two chart leaves are the only client code. |
| `/api/session` | dynamic | `ƒ` | **New on Day 48.** Reads the session cookie so the *static* layout does not have to. `no-store`. |
| `/api/orders/[id]/stream` | dynamic | `ƒ` (`force-dynamic`) | **New on Day 47.** Server-sent events; 401/404 before any stream opens. |
| `/api/orders/export` | dynamic | `ƒ` (`force-dynamic`) | **New on Day 47.** The session's own orders as CSV. |

**Marker legend.** The reading sheet shows `λ` for dynamic. Next.js 14 prints `ƒ` for the same thing; `○` static and `●` SSG are unchanged.

**What keeps routes static.** `app/layout.js` and every shared helper read no cookies or headers. Only `/checkout`, `/signin`, `/orders`, `/orders/[id]`, `/kitchen`, `/dashboard`, the server actions and the `/api/orders*` and `/api/session` handlers import `lib/session.js`. **Day 48:** the header is now sign-in-aware, but it learns that from `GET /api/session` after hydration, not from a cookie read in the layout — so the layout, and with it `/`, `/cart` and `/menu/[id]`, stays static. The static routes are still `/`, `/cart` and `/menu/[id]`.

**Middleware (Day 42).** `middleware.js` runs before the matched private paths only (`/checkout`, `/orders`, `/kitchen`, `/dashboard`) and does not change how any route is rendered. See `AUTH.md`. One cookie read in the layout would turn every route dynamic.

**A route whose answer changed while writing this.** `/cart` first looked like a candidate for server rendering from a cart cookie. But a cookie sent on every request means the cart leaves the browser on every page view, and it would make every page that shows the badge dynamic. The cart stays client-only; only `{ id, quantity }` is mirrored into a cookie scoped to `Path=/checkout`, so the browser sends it to checkout and nowhere else.


**Pages whose rendering is checked against `npm run build`'s route table:** *not yet.* The table above is the intended result; the build could not run where this was written (see `README.md`). Read the real table on your machine and fix whichever row disagrees.
