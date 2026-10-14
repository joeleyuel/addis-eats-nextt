import "server-only";
import { cache } from "react";
import { readFile } from "node:fs/promises";
import path from "node:path";

// The one place that knows where dishes live. Server components call these
// directly — no HTTP hop to our own /api/dishes.
const MENU_FILE = path.join(process.cwd(), "data", "menu-data.json");

export const getDishes = cache(async function getDishes() {
  const raw = await readFile(MENU_FILE, "utf8");
  const data = JSON.parse(raw);
  if (!Array.isArray(data)) {
    throw new Error("The menu data is malformed.");
  }
  return data;
});

export async function getDishById(id) {
  const dishes = await getDishes();
  return dishes.find((dish) => dish.id === id) ?? null;
}

// Search + category + optional paging, shared by /menu (first paint) and
// GET /api/dishes (every later fetch), so both answer identically.
//   page == null → every match (search)      page = n → one page (browsing)
// An out-of-range page is clamped to the last page.
export async function queryDishes({ q = "", category = "All", page = null, pageSize = 6 } = {}) {
  const dishes = await getDishes();
  const term = q.trim().toLowerCase();
  const matches = dishes.filter(
    (dish) =>
      (category === "All" || dish.category === category) &&
      (!term || `${dish.name} ${dish.shortDescription}`.toLowerCase().includes(term))
  );

  if (page == null) {
    return { items: matches, total: matches.length, page: 1, pageSize: matches.length, totalPages: 1 };
  }
  const totalPages = Math.max(1, Math.ceil(matches.length / pageSize));
  const current = Math.min(Math.max(1, page), totalPages);
  const start = (current - 1) * pageSize;
  return {
    items: matches.slice(start, start + pageSize),
    total: matches.length,
    page: current,
    pageSize,
    totalPages,
  };
}
