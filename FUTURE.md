# FUTURE.md — what was cut, and what comes next

Cut on purpose (the "Coulds" — nobody completing an order would miss them):

- **Real courier data.** The courier on the map is simulated from the order's age (`lib/tracking.js`). A real one needs a courier app or GPS feed, i.e. the Module 4 API.
- **Exact delivery pins.** The delivery marker is the approximate centre of the neighbourhood. Geocoding the typed address needs a geocoding service and a place to store the result.
- **A production map tile source.** The public OpenStreetMap tile server is for coursework; swap in a tile provider before real traffic.
- **A `delivered` status.** The API still has four statuses; "courier has arrived" is a flag on the tracking payload so the contract did not change.
- **Persistence.** Orders, revocation and the duplicate-order guard are in memory (see `AUTH.md › Known limits`). A database and an idempotency key stored with the order are the real fix.
- **A password / real sign-in.**
- **Dashboard date-range picker and per-day drill-down;** CSV export for staff (all orders).
- **Ethiopian calendar and 12-hour-from-dawn clock** (needs a dedicated library; `Intl` will not do it). Decision: not supported, on purpose.
- **Ordering tweaks:** edit an order, reorder from history, saved addresses.

Not done because the environment could not do it (these are first in the queue, not "Coulds"): `npm install` of the new packages, `npm run lint`, `npm run build`, Lighthouse numbers, a real-phone pass, the deployment to Vercel and the post-deployment checks. See `README.md`.
