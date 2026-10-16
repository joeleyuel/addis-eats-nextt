# BOUNDARY.md — server / client, one line per component

Server-first: everything is a server component until something forces `"use client"`. **18 files carry the directive** (11 + 7 added on Days 46–47), all leaves or wrappers that take children.

## Client (18)

| File | Why it must be client |
| --- | --- |
| `components/Providers.js` | Cart context needs state. Receives the pages as `children`, so they stay server components. |
| `components/SiteHeader.js` | Hamburger state (Escape / outside-tap / route-change close), active link (`usePathname`), the cart badge (reads the store) and `useSWR('/api/session')` for which links to show. |
| `components/AddToCartButton.js` | `onClick` writes to the cart store; the detail variant holds the quantity. Receives five plain fields, not the dish. |
| `components/FoodImage.js` | `onError` swaps in a placeholder when a third-party photo is gone. Plain-string props. |
| `app/menu/MenuBrowser.js` | Search text is state, and the menu data comes from SWR hooks. Replaces Day 40's `MenuFilter`. It renders `DishCard` itself from fetched data; the server passes it plain data (`initialData`, `initialQuery`), no functions. |
| `app/menu/CategoryBar.js` | Selection buttons; the `onSelect` callback only travels client → client. |
| `app/menu/error.js` | Next.js requires error boundaries to be client components (they get `reset`). |
| `app/cart/CartView.js` | The whole screen *is* the browser's cart store. |
| `app/checkout/CheckoutForm.js` | Controlled fields, touched tracking, live delivery fee, `useFormState`. Still a real `<form action={placeOrder}>`. |
| `app/checkout/OrderTracker.js` | Empties the browser cart (localStorage) once the order exists, and renders `OrderStatus`. No longer polls itself. |
| `app/dashboard/RevenueChart.js`, `app/dashboard/OrdersChart.js` | **Day 46.** Recharts measures the DOM, so only the chart is a client leaf; the page stays a server component. Each receives 5 / 30 plain summarised rows, a fixed 300 px height and an ETB formatter. |
| `app/orders/[id]/LiveTracking.js` | **Day 47.** `EventSource` + effect cleanup; seeded from the server render (`initial` is plain data). Falls back to SWR polling. |
| `app/orders/[id]/MapPanel.js` | **Day 47.** `next/dynamic` with `ssr: false` needs a client component. Loads `DeliveryMap` only in the browser. |
| `app/orders/[id]/DeliveryMap.js` | **Day 47.** Leaflet touches `window` on import — reachable only through `MapPanel`. |
| `app/orders/error.js`, `app/dashboard/error.js` | Error boundaries must be client components (they receive `reset`). |
| `app/orders/OrderStatus.js` | `useSWR` hook: polls `/api/orders/[id]` every 5 s. Receives a plain `{ id, status }` object as `initial` (→ `fallbackData`). |

## Server (no directive)

| File | Notes |
| --- | --- |
| `app/layout.js` | Passes `children` into `Providers`; reads no cookies. |
| `app/page.js`, `app/menu/page.js`, `app/menu/[id]/page.js`, `app/checkout/page.js`, `app/orders/[id]/page.js` | Await their own data. `/menu` reads `searchParams` and passes plain data to `MenuBrowser`. |
| `app/menu/layout.js`, `app/menu/loading.js`, `app/not-found.js`, `app/cart/page.js` | Static markup. |
| `app/signin/SignInPanel.js`, `app/checkout/Confirmation.js` | Plain `<form action={serverAction}>`, no client JS. (`SignInPanel` moved from `app/checkout` on Day 42.) |
| `components/OrderTable.js`, `components/TableSkeleton.js`, `app/dashboard/page.js`, `app/orders/loading.js`, `app/dashboard/loading.js` | **Days 46.** The order table (caption, `thead`, `th scope`, `aria-sort`, `Link` pager) is read-only, so it ships nothing to the browser. |
| `app/signin/page.js`, `app/orders/page.js`, `app/kitchen/page.js` | Day 42 private/auth pages. Await the session on the server (`getSession` / `requireSession`) — auth is never checked in a client component. |
| `middleware.js` | Edge runtime, project root. Imports only `lib/session-cookie.js` (no other imports). Not a server or client component. |
| `components/DishCard.js`, `components/SiteFooter.js` | Markup only. `DishCard` is now also rendered inside `MenuBrowser`, so it runs on both sides — it has no hooks or server-only imports. |
| `app/actions.js` (`"use server"`) | `signIn`, `signOut`, `placeOrder`, `cancelOrder`. |
| `app/api/**/route.js`, `lib/*` | Route handlers and server-only helpers (`lib/dishes`, `lib/orders`, `lib/session` import `server-only`). |

## Directive-free modules shared across the boundary

`components/QuantityStepper.js` (presentational; used from the client cart), `lib/csv.js`, `lib/stats.js`, `lib/order-table.js`, `lib/tracking.js`, `components/Button.js`, `EmptyState.js`, `ErrorState.js`, `Spinner.js`, `app/checkout/Field.js`, `components/useDebounce.js`, `lib/fetcher.js`, `lib/paging.js`, `lib/safe-next.js`, `lib/session-cookie.js`, `lib/validate.js`, `lib/delivery.js`, `lib/format.js`, `lib/cart.js`, `lib/categories.js`. No server-only imports, so either side may use them. `lib/validate.js` is the single validation schema used by the form, the action and the route handler.

## Rules this layout follows

- No function props cross the boundary from server to client (`CategoryBar.onSelect` is client-to-client).
- Nothing sensitive is client-reachable: `SESSION_SECRET` and `STAFF_PHONES` are read only in `lib/session.js` (`server-only`, no `NEXT_PUBLIC_` prefix); the session cookie is `httpOnly`, `secure` (production) and `sameSite=lax`; prices are re-read from the server's menu, never trusted from the client.

## Admin console

**Client (8 new files, all under `app/admin/_components/`):** `AdminNav` (active link via `usePathname`), `ConfirmDialog` (native `<dialog>` + `showModal`), `OrderStatusForm`, `DeleteDishButton`, `DishForm` (controlled fields, `fetch` to the admin API), `AutoRefresh` (`router.refresh` on a timer, opt-in). The two charts are the existing `RevenueChart` / `OrdersChart` client leaves. None of them receives a function from a server component, and none reads a secret: they receive plain strings/numbers (`DishForm` gets the dish as strings; `OrderStatusForm` gets an id and a status).

**Server:** every page under `app/admin/` (`requireAdmin()` first), `Pagination`, `StatusPill`, `PageHeader`, `app/admin/actions.js` (`"use server"`: `adminSignIn`), the `/api/admin/*` handlers, `lib/admin-auth.js`, `lib/admin-api.js`, `lib/images.js` (`server-only`).

**Shared (no server-only imports):** `lib/roles.js`, `lib/order-status.js`, `lib/dish-validate.js` (the one dish schema: form and API), `lib/admin-filters.js`, `lib/privacy.js`, `lib/rate-limit.js`, and `lib/safe-next.js` (now also `safeAdminNext`, `adminSignInUrl`).
