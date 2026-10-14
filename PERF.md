# PERF.md — performance budget (Day 45) and the Day 43 / 44 measurement log

## Day 45 — the budget (decision table 3)

**Only one row below has real numbers.** Lighthouse, a throttled Network tab and `next build` output were not available where this was written (no npm registry, no Chrome), so every other cell is marked *not measured* rather than guessed. A budget with a made-up number is worse than a blank one.

| Measure | Target | Before (Day 44 build) | After (Day 45 build) |
| --- | --- | --- | --- |
| LCP, throttled (Slow 4G, 4× CPU) | Under 2.5 s | *not measured* | *not measured* |
| CLS | Under 0.1 | *not measured* | *not measured* |
| First Load JS, `/menu` | Under 120 kB | *not measured* — read it from the `npm run build` route table | *not measured* |
| Largest image (source file in `public/images`) | Under 150 kB | **206,913 B** (`Shiro Tegabino Pot.jpg`) — 5 of 13 files were over 150,000 B | **148,618 B** (`Gusto Smoky Beef Burger.jpg`) — all 13 files under 150,000 B |
| Lighthouse performance | 90 or better | *not measured* | *not measured* |

### The one measured change, and its cause

Five dish photos (Kitfo 189,116 B, Beyaynetu 165,629 B, Burger 191,540 B, Shiro 206,913 B, Sizzling Tibs 173,857 B) were re-encoded as JPEG with mozjpeg (quality 76–82, same pixel dimensions, same file names, so `data/menu-data.json` is unchanged). They are now 145,770 / 139,919 / 148,618 / 144,178 / 142,832 B. The other eight files were already under the limit and were not touched. Sizes were read with `fs.statSync` on the files; this is the **source** size. `next/image` serves a resized AVIF/WebP of each, so the bytes a phone downloads are what the Network tab shows, not these numbers — re-check there.

Cost: a small, probably invisible loss of detail on those five photos. If you prefer the originals, restore them from Day 44 and treat this row as "failed, because the originals are 150–207 kB source files that `next/image` shrinks anyway".

### To fill the rest (the sheet's rules)

1. **Before** = the Day 44 project; **after** = this one. For each: `npm run build && npm run start` (never `npm run dev`), Chrome → Lighthouse (Mobile) with Network **Slow 4G** and CPU **4× slowdown**, on `/` and `/menu`, ideally on the deployed preview.
2. LCP/CLS/performance score from Lighthouse; First Load JS for `/menu` from the build's route table.
3. If a number does not come down, write why next to it — a documented failure you understand is worth more than a number you cannot explain.

Day 45 itself added almost nothing that can move these numbers: one extra static nav link and two sign-out forms on private pages (no new JavaScript beyond the existing server-action form handling). Expect Day 44's numbers to carry over; do not claim an improvement you have not measured.

---

## Day 43 — Making Addis Eats Fast (earlier log, unchanged)

## Status: numbers NOT yet recorded

This project was prepared in an environment with no access to the npm registry, Chrome or Lighthouse, so **no Lighthouse run, `npm run build` or `npm run lint` has been executed for Day 43**. Every cell marked `—` below must be filled in by you. Nothing in this file is a measured result.

## How to measure (the sheet's rules)

1. Take the **before** run from the Day 42 project (`npm run build && npm run start`, never `npm run dev`).
2. Chrome → DevTools → Lighthouse, Mobile, plus Network: **Slow 4G**, CPU: **4x slowdown**.
3. Run on `/` (hero) and `/menu`. Record LCP, CLS, INP (Lighthouse reports TBT as a lab stand-in for INP; say so if you use it) and total page weight from the Network tab.
4. Repeat on this Day 43 build after the changes.
5. Optionally apply the changes one at a time (order below) to fill the per-change table.

## Results

| Page | Metric | Before (Day 42) | After (Day 43) |
|------|--------|-----------------|----------------|
| `/`     | LCP         | — | — |
| `/`     | CLS         | — | — |
| `/`     | INP / TBT   | — | — |
| `/`     | Page weight | — | — |
| `/menu` | LCP         | — | — |
| `/menu` | CLS         | — | — |
| `/menu` | INP / TBT   | — | — |
| `/menu` | Page weight | — | — |

Per-change breakdown (fill in; the biggest drop is your answer to "which single change did most of it?"):

| Change | LCP | Page weight |
|--------|-----|-------------|
| Starting point (Day 42) | — | — |
| `<img>` → `next/image` with `sizes` | — | — |
| `priority` on the home hero | — | — |
| `next/font` replaces the Google `<link>` tags | — | — |

## What changed and why (expected cause, to be confirmed by your numbers)

| Change | Files | Expected effect |
|--------|-------|-----------------|
| Every photo through `next/image` with `width`, `height`, `sizes`, `alt` | `components/FoodImage.js` (wrapper), `DishCard.js`, `app/menu/[id]/page.js`, `app/cart/CartView.js`, `app/page.js` | Photos were full-size third-party files (some original-size, e.g. the Flickr `_o.jpg` hero). They are now resized per device, served as AVIF/WebP and lazy-loaded; width/height reserve space (CLS). Expected to be the largest LCP and weight change, as in the sheet's worked example. |
| `priority` on exactly one image | `app/page.js` (home hero) | Hero is the largest above-the-fold image on `/`, so it is preloaded and not lazy. Every other image is lazy. |
| Remote hosts listed | `next.config.mjs` (`IMAGE_HOSTS`, 14 hosts) | Required for the optimiser to accept the third-party photos; unlisted hosts fail on purpose. |
| `next/font` replaces `<link>` tags | `app/layout.js`, `app/globals.css` | Removes the request to Google Fonts and the render-blocking stylesheet; self-hosted with a metric-matched fallback → less font-driven layout shift. |
| Third-party scripts | — | **There were none** in Day 42 (no analytics or chat widget), so nothing to move. If you add one, use `next/script` with `strategy="lazyOnload"`. |
| Environment setup | `.env.example`, `.gitignore`, `scripts/check-env.mjs` | A stranger can see every variable to set. `.env*.local` is gitignored. No secret is `NEXT_PUBLIC_`. `npm run check:env` fails fast on a missing or example secret. |
| Config | `next.config.mjs` | Static redirect (`/dishes/:id` → `/menu/:id`) and basic security headers live in config, not middleware. |

## Known trade-offs / things to look at

- **One `priority` image only**, per the sheet. The dish detail page's main photo is its own above-the-fold image but is lazy-loaded; if its LCP is poor in your measurements, that is the first thing to revisit.
- **Cart thumbnails use `alt=""`**: they are decorative because the dish name is the adjacent heading (the sheet allows empty alt for decoration). All other images have the dish name as alt.
- Photos are third-party; optimisation cannot fix a slow or missing origin. Self-hosting licensed photos (see `IMAGE_SOURCES.md`) would be the next step.
- `formatETB` still prints `480 ETB` (Day 35 behaviour, unchanged) rather than the sheet's `en-ET` currency style.
- `next/font/google` downloads the font files at **build time**, so the first `npm run build` needs network access.

## Check yourself (answer after measuring)

- Did LCP improve, and which single change did most of it? —
- Does the page still jump as it loads? What is not reserving space? —
- Were you measuring `npm run start`, throttled? —
- Can a stranger clone the repo and know which variables to set? (`.env.example`) —
- Anything in the browser bundle you would not want published? (search `.next/static` for the secret) —

---

## Days 46–48 — what the new screens cost, and what was NOT measured

**Nothing below was measured.** There is no npm registry, Chrome-with-Lighthouse, or deployed URL where this was written, so every cell is *not measured*. The structural facts are real; the numbers are yours to take on `npm run build && npm run start`.

| Measure | Target | Result |
| --- | --- | --- |
| First Load JS, `/dashboard` | under 150 kB (it carries Recharts) | *not measured* — read it from the build's route table |
| First Load JS, `/orders/[id]` | under 120 kB | *not measured* — Leaflet is **not** in it: it is a dynamic import with `ssr: false`, fetched only when this page opens |
| First Load JS, `/menu`, `/`, `/cart` | unchanged from Day 45 | *not measured*. The header now imports SWR (already a dependency) and `/api/session`; expect a small rise on **every** page |
| CLS on `/dashboard` and `/orders/[id]` | under 0.1 | *not measured* — by design: chart boxes are a fixed 300 px (CSS and `ResponsiveContainer`), the map placeholder is exactly 320 px (280 px on tablets), loading skeletons are the shape of the table |
| Extra requests per page | — | **+1** `GET /api/session` after hydration and after each route change (tiny JSON, `no-store`) |
| Rows sent to the browser, dashboard | three, not four thousand | **5 + 30 summarised rows** to the charts and one page of **10** order rows (`npm test` checks the aggregation and paging) |

Two new third-party libraries load only where needed: **Recharts** (client leaves on `/dashboard`) and **Leaflet/React-Leaflet** (browser only, order page). If `/orders/[id]` or `/dashboard` misses a budget, look at those two first, then at `OrderTable`, which is a server component and ships no JS.
