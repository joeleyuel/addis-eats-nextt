# ADMIN.md — the admin console (`/admin`)

A server-rendered console for running the restaurant: an overview with real numbers, orders (search, filter, change status), dishes (add, edit, delete) and customers. It reuses the existing session, order store, menu file, tables, pills, charts and design tokens. Nothing in it is sample data: with no orders the cards say 0 and the charts are replaced by an empty state.

## Run it

```bash
npm install
cp .env.example .env.local
# 1. SESSION_SECRET  (already required)
# 2. choose who may be admin, and a long secret code:
#      ADMIN_PHONES=0933000000
#      ADMIN_ACCESS_CODE=<output of: node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))">
npm run check:env
npm run dev          # then open http://localhost:3000/admin
```

`/admin` sends you to `/admin/signin`: enter your name, an `ADMIN_PHONES` number and the access code. **If `ADMIN_PHONES` or `ADMIN_ACCESS_CODE` is empty (or the code is under 12 characters) admin sign-in is switched off** — nobody can get in. There is deliberately no default code. The header shows an **Admin** link once you are signed in as admin.

| Variable | Purpose | Secret? |
| --- | --- | --- |
| `ADMIN_PHONES` | Comma-separated phones that may sign in as admin | Server only |
| `ADMIN_ACCESS_CODE` | The second factor typed on `/admin/signin` (≥ 12 chars) | **Yes**, server only, never `NEXT_PUBLIC_` |
| `SESSION_SECRET` | Already required: signs the cookie | **Yes** |

Set them in `.env.local` (gitignored) or the host's environment. They are read only in `lib/admin-auth.js` (`server-only`).

## What you can do

| Screen | Route | Notes |
| --- | --- | --- |
| Overview | `/admin` | Orders, revenue, average order, active orders, customers, dishes; latest orders; orders by status; recent activity; revenue by neighbourhood and orders per day (the existing Recharts components, each with a "show as table" fallback); best-selling dishes |
| Orders | `/admin/orders` | Search (order no., name, phone digits), status tabs with counts, area and date filters, sortable columns, paging; all state is in the URL |
| Order detail | `/admin/orders/AE-12345` | Items, totals, full phone and address (the only place they appear), **status control** |
| Dishes | `/admin/dishes`, `/new`, `/<id>` | Search, category filter, paging; add, edit, delete (with confirmation) |
| Customers | `/admin/customers` | Who has ordered, orders, cancelled, spend, last order; **phone masked** (`0911 ••• 567`) |

On a phone the sidebar becomes a row of tabs above the content; tables scroll inside their own box.

## How it is secured

The existing three layers (see `AUTH.md`), plus a stronger way in:

1. **A separate sign-in with a real secret.** The normal sign-in has no password (anyone who types a staff number *is* staff), so it can **never** produce the new `admin` role — `roleForPhone` only returns `customer` or `staff`, and a tested check proves `role=admin` in the form is ignored. `/admin/signin` needs a listed phone **and** `ADMIN_ACCESS_CODE` (compared as equal-length hashes with `timingSafeEqual`). Every failure gives the same message. Failures are throttled per address *and* per phone (5 / 10 per 15 min, in memory — a brake, not the lock; the long random code is the lock). The admin session lasts **4 h** (customers 8 h), is `httpOnly`, `secure` in production, `sameSite=lax`, and is revoked on sign-out.
2. **Middleware** only redirects a cookie-less visitor to `/admin/signin`. It proves nothing.
3. **Every admin page calls `requireAdmin()`** — not just the layout, because Next.js does not re-run a layout when you move between pages inside it. Signed out → sign-in; signed in but not admin → the same 404 as any unknown URL.
4. **Every `/api/admin/*` handler calls `authorizeAdmin()`**: `401` signed out, `403` not admin; for writes also a same-origin check (a cross-site `Origin` or `Sec-Fetch-Site` is refused), `Content-Type: application/json` (`415`), a 32 KB body cap (`413`), and `Cache-Control: no-store`.
5. **The data functions check the role again, next to the data** (`lib/orders.js`, `lib/dishes.js`): `listOrdersForAdmin`, `queryAdminOrders`, `queryAdminCustomers`, `adminOverview`, `adminOrderDetail`, `setOrderStatusFor`, `createDish`, `updateDish`, `deleteDish`. **Staff are not enough** — only `admin`. Searching by phone happens inside these functions, on the real number; lists only ever receive the masked one.
6. **Validation on the server.** Dishes go through `lib/dish-validate.js` — the same schema the form uses. Only whitelisted fields are read (an `id`, `rating` or `reviews` in a request is ignored — no mass assignment); control characters are stripped; the price is a whole number in range; the photo must be a file under `/images/` (no URL, no `..`); URL parameters for lists are whitelisted or clamped (`lib/admin-filters.js`). Output is escaped by React.
7. **Return links** (`?next=`) on the admin sign-in can only point inside `/admin` (`safeAdminNext`).

Admins also keep access to `/kitchen` and `/dashboard`.

## Things to know (honest limits)

- **Order status.** Status used to be derived from an order's age only. Setting it by hand stores a `statusOverride` that wins over the clock from then on (so the customer's tracking page and CSV show it too); "cancelled" cancels, any other status reinstates a cancelled order. The four statuses are unchanged — there is still no `delivered` (see `FUTURE.md`). Only the *latest* manual change per order is remembered, so "recent activity" shows that and nothing older.
- **Orders live in memory** (as before): a restart empties them, and several server instances do not share them. The failed-login counter and revoked sessions are the same.
- **Dishes live in `data/menu-data.json`.** Saving rewrites that file (queued, written to a temp file then renamed, re-read before every write). That works wherever the server has a writable disk (`npm run dev`, `npm start` on a VPS or in a container with a volume). **On a read-only host such as Vercel's serverless functions it cannot work**: the API answers `503` with an explanation rather than pretending. Production needs a database; `lib/dishes.js` is the one module to change. Because the file is edited, commit or back it up if you care about the changes.
- **Photos are not uploaded.** A dish uses a file already in `public/images` (the form suggests the existing ones). Uploading needs file storage that this project does not have.
- **Customers are derived from orders.** The app has no user table; someone who signed in but never ordered is not listed.
- **New dishes** start with rating 0 and no reviews and show "New" instead of "★ 0.0". Ratings come from customers; the admin cannot set them.
- **Cache.** After a dish change the handlers call `revalidatePath("/", "layout")`, because the home page and each `/menu/[id]` page are prerendered from the menu file.
- Deleting a dish does not touch past orders (they keep their own copy of name and price); the last dish cannot be deleted.
- Two admins editing the same dish: last save wins.

## Verification

`npm test` now runs three suites (`verify-auth`, `verify-ui`, `verify-admin`) and `check-imports`. `scripts/verify-admin.mjs` (30 checks) runs the **real** session, orders, dishes, sign-in action and route-handler code with stand-ins only for `cookies()`, `headers()`, `redirect()` and `revalidatePath()`; dish writes go to a temp copy of the menu. It covers: admin cannot be obtained through the normal sign-in or a forged token; wrong code / wrong phone are indistinguishable; throttling; fail-closed configuration; customers and staff get `null`/`401`/`403`/404 from every admin function and endpoint; cross-site writes refused; status changes stick and are visible to the customer; lists are masked; filters and search; customer and overview figures; dish create / update / delete, duplicate names, id and rating ignored, the last dish kept, concurrent saves not lost; replaying an admin cookie after sign-out fails.

**Not verified in this environment (no network, so `npm install` was impossible):** `npm run lint`, `npm run build` and `npm run dev` were **not run**; no page was rendered, so layout, the mobile tab bar, the confirm dialog, focus handling and chart rendering are untested in a browser; the `503` for a read-only disk is not simulated; real HTTPS cookies are untested. The JSX in all 124 source files was parsed with TypeScript's parser (0 syntax errors) and unused imports were scanned, but that is not a build. Run `npm install && npm run lint && npm run build` first and fix anything they report, then walk through the checklist below.

### Checklist for the first real run

1. Signed out: open `/admin` → lands on `/admin/signin`. `curl -i -X PATCH localhost:3000/api/admin/orders/AE-12345 -H 'content-type: application/json' -d '{"status":"preparing"}'` → `401`.
2. Sign in normally as a customer: `/admin` → 404; the same `curl` with that cookie → `403`; `/kitchen` → 404 unless you are in `STAFF_PHONES`.
3. Admin sign-in with a wrong code → one generic message; with the right one → `/admin`.
4. Place an order as a customer, then in `/admin/orders` open it, set "Preparing", and watch `/orders/<id>` follow. Cancel it from the admin (confirm dialog) and reinstate it.
5. Add a dish, see it on `/menu` and `/menu/<id>`; edit its price; delete it (confirm dialog); check `data/menu-data.json` changed (and `git checkout` it afterwards if this was a trial).
6. Keyboard only: Tab through the sidebar, a filter form, a table, the dish form and the confirm dialog (Escape closes it; focus returns). Resize to 360 px wide.
