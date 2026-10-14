import { queryDishes, getDishes } from "@/lib/dishes";
import { normalizeCategory } from "@/lib/categories";
import { DISHES_PAGE_SIZE, parsePage } from "@/lib/paging";

// GET /api/dishes
//   (no query)                  → the whole menu as an array, as on Day 40 (for
//                                 things OUTSIDE our pages: a partner site, an app)
//   ?q=tibs &category=Pizza     → { items, total, page, pageSize, totalPages }
//   &page=2                       with page → one page; without → every match
//
// It reads the query string, so it is dynamic (ƒ) — it was a static, hourly
// route on Day 40 while it ignored the URL.
export const dynamic = "force-dynamic";

export async function GET(request) {
  const { searchParams } = new URL(request.url);

  if (!["q", "category", "page"].some((name) => searchParams.has(name))) {
    return Response.json(await getDishes());
  }

  const result = await queryDishes({
    q: (searchParams.get("q") || "").slice(0, 100),
    category: normalizeCategory(searchParams.get("category")),
    page: searchParams.has("page") ? parsePage(searchParams.get("page")) : null,
    pageSize: DISHES_PAGE_SIZE,
  });
  return Response.json(result);
}
