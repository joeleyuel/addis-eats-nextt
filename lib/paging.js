// Shared by the menu page (server), the dishes API (server) and MenuBrowser
// (client), so all three agree on page size, page parsing and the SWR key.
// Pure functions only — no server-only imports.
export const DISHES_PAGE_SIZE = 6;

// "?page=abc", "?page=0", "?page=-2", a missing value → page 1.
export function parsePage(value) {
  const raw = Array.isArray(value) ? value[0] : value;
  const page = Number.parseInt(raw ?? "", 10);
  return Number.isInteger(page) && page >= 1 ? page : 1;
}

// The query key. It is also the URL, so the key and the request cannot drift.
// `page` is omitted for search (all matches); `q` is omitted for browsing.
export function dishesUrl({ q, category, page } = {}) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (category && category !== "All") params.set("category", category);
  if (page != null) params.set("page", String(page));
  return `/api/dishes?${params.toString()}`;
}
