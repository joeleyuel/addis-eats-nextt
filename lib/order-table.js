// Sorting, paging and links for the order tables (Day 46). The state lives in the URL
// (?sort=total&dir=desc&page=3), so a page is shareable, survives a refresh and the
// table stays a server component. Everything that arrives from the URL is untrusted:
// it is checked against a whitelist or clamped, never used as-is. Pure functions.
export const SORT_KEYS = ["date", "id", "status", "total"];
export const PAGE_SIZE = 10;

const STATUS_RANK = { received: 0, preparing: 1, on_the_way: 2, cancelled: 3 };
const first = (value) => (Array.isArray(value) ? value[0] : value);

export function parseSort(value) {
  const raw = first(value);
  return SORT_KEYS.includes(raw) ? raw : "date";
}

export function parseDir(value) {
  return first(value) === "asc" ? "asc" : "desc";
}

// Newest first, biggest first; ids and statuses read naturally ascending.
export function defaultDir(sort) {
  return sort === "id" || sort === "status" ? "asc" : "desc";
}

export function sortRows(rows, sort, dir) {
  const sign = dir === "asc" ? 1 : -1;
  const value = {
    date: (r) => r.createdAt,
    total: (r) => r.total,
    id: (r) => r.id,
    status: (r) => STATUS_RANK[r.status] ?? 99,
  }[sort];
  return [...rows].sort((a, b) => {
    const x = value(a);
    const y = value(b);
    if (x < y) return -sign;
    if (x > y) return sign;
    return b.createdAt - a.createdAt || (a.id < b.id ? -1 : 1); // stable, deterministic
  });
}

// An out-of-range page is clamped to the last page.
export function paginate(rows, page, pageSize = PAGE_SIZE) {
  const total = rows.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(Math.max(1, Number.isInteger(page) ? page : 1), pages);
  const start = (current - 1) * pageSize;
  return { rows: rows.slice(start, start + pageSize), total, page: current, pages, pageSize };
}

// A real URL for every state; defaults are left out so URLs stay short.
export function tableHref(basePath, { sort = "date", dir, page = 1 } = {}) {
  const params = new URLSearchParams();
  const effectiveDir = dir ?? defaultDir(sort);
  if (sort !== "date" || effectiveDir !== "desc") {
    params.set("sort", sort);
    params.set("dir", effectiveDir);
  }
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}

// [1, "…", 4, 5, 6, "…", 12]
export function pageWindow(page, pages) {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const keep = new Set([1, pages, page - 1, page, page + 1]);
  const list = [...keep].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);
  const out = [];
  list.forEach((n, i) => {
    if (i > 0 && n - list[i - 1] > 1) out.push("…");
    out.push(n);
  });
  return out;
}
