# SEO.md — Day 44: Metadata & SEO

**Not verified in a running app.** `npm install`, `npm run lint` and `npm run build` could not be run where this was written (npm registry blocked), so nothing below has been viewed in page source or in a preview debugger. The "How to verify" list is for you to run. Build output: **not captured**.

## What was added

| Requirement (Day 44 sheet) | Where |
|---|---|
| `metadataBase` + title template + default title | `app/layout.js` (`template: "%s · Addis Eats"`, default `Addis Eats — food delivery in Addis Ababa`) |
| Production URL in one place | `lib/site.js` (`NEXT_PUBLIC_SITE_URL`, default `https://addiseats.et`; documented in `.env.example`) |
| Distinct description on every route | `app/page.js`, `app/menu/page.js`, `app/cart/page.js`, `app/signin/page.js`, `app/checkout/page.js`, `app/orders/page.js`, `app/orders/[id]/page.js`, `app/kitchen/page.js`, `app/not-found.js`; dishes via `generateMetadata` |
| `generateMetadata` on the dish route | `app/menu/[id]/page.js`: title = name; description = `name — price ETB. shortDescription`; canonical; Open Graph |
| Site-wide `opengraph-image` (1200 × 630) | `app/opengraph-image.jsx` (generated with `ImageResponse`) |
| Generated OG image per dish (1200 × 630) | `app/menu/[id]/opengraph-image.jsx` |
| `MenuItem` JSON-LD from the rendered dish object | `app/menu/[id]/page.js` (name, price, `priceCurrency: "ETB"`; `<` escaped) |
| `app/sitemap.js` from real data, private routes excluded | `app/sitemap.js` (home, `/menu`, every dish) |
| `robots.js` disallowing private routes, pointing at the sitemap | `app/robots.js` (`/cart`, `/checkout`, `/orders`, `/kitchen`, `/signin`, `/api/`) |
| Canonical on routes that take query parameters | `/menu` (`?category`, `?page`), `/signin` (`?next`, `?error`), `/checkout` (`?order`); also `/` and each dish |
| Exactly one `h1` per page | Already true on every page except `not-found`, which had none: `EmptyState` gained a `headingLevel` prop and `not-found` uses `1` |

## Choices to know about

- Titles: `/menu` is now `Menu` (as in the sheet) instead of `Explore Menu`; the page `h1` still says "Explore Menu". The root default title follows the sheet.
- Only dish pages set `openGraph` themselves (their image file lives in the same segment). Other routes inherit the root `openGraph` and site-wide image, to avoid a child `openGraph` replacing the inherited one.
- The OG cards are text-only (dish name, price, category). They use flexbox only; Satori fails silently on unsupported CSS, so look at the images.
- `/signin` is disallowed in robots and left out of the sitemap; it is a sign-in form, not content.
- JSON-LD does not include rating or opening hours because those are not the same data the page presents as structured fields; the sheet requires the JSON-LD to match the page.
- If you change an OG design after sharing links, platforms cache the old card for days.

## How to verify (production build, view source)

```bash
npm install && npm run lint && npm run build && npm run start
curl -s localhost:3000/menu/doro-wot-deluxe | grep -o '<meta[^>]*og:[^>]*>'   # absolute https://addiseats.et URLs
curl -s localhost:3000/menu/doro-wot-deluxe | grep -o 'application/ld+json.*</script>'
curl -s localhost:3000/menu/awaze-beef-tibs | grep -o '<meta name="description"[^>]*>'   # differs from the dish above
curl -s localhost:3000/sitemap.xml        # no /cart /checkout /orders /kitchen /dashboard /signin
curl -s localhost:3000/robots.txt
curl -s localhost:3000/menu/doro-wot-deluxe/opengraph-image -o og.png   # open it: 1200 × 630
curl -s 'localhost:3000/menu?page=2' | grep -o '<link rel="canonical"[^>]*>'   # → /menu
```

Then check each page has one `h1`, and paste a dish URL into a social debugger once deployed.

**Day 46–48:** `/dashboard` is disallowed in robots like the other private routes and is not in the sitemap. The new pages are private and carry no structured data.
