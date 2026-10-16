// URL state for the admin lists (search, status, area, dates, sort, page). Like the order
// table on /dashboard, the state lives in the URL — a filtered view can be bookmarked, shared
// between admins and survives a refresh, and the lists stay server components.
//
// Everything that arrives from the URL is untrusted: it is checked against a whitelist or
// clamped here, never used as it came. Pure functions, no imports from the server.
import { DELIVERY_AREAS } from "./delivery.js";
import { ORDER_STATUSES } from "./order-status.js";
import { SORT_KEYS, parseDir, parseSort } from "./order-table.js";
import { CATEGORIES, normalizeCategory } from "./categories.js";
import { parsePage } from "./paging.js";

const first = (value) => (Array.isArray(value) ? value[0] : value);
const text = (value, max = 60) => (typeof first(value) === "string" ? first(value).replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max) : "");

// "2026-10-14" only, and a real calendar day ("2026-02-31" is refused).
export function parseDay(value) {
  const raw = first(value);
  if (typeof raw !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return "";
  const date = new Date(`${raw}T00:00:00Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== raw ? "" : raw;
}

export function parseOrderFilters(searchParams = {}) {
  const status = first(searchParams.status);
  const area = first(searchParams.area);
  let from = parseDay(searchParams.from);
  let to = parseDay(searchParams.to);
  if (from && to && from > to) [from, to] = [to, from]; // a reversed range is the same range
  return {
    q: text(searchParams.q),
    status: ORDER_STATUSES.includes(status) ? status : "",
    area: DELIVERY_AREAS.some((a) => a.id === area) ? area : "",
    from,
    to,
    sort: parseSort(searchParams.sort),
    dir: parseDir(searchParams.dir),
    page: parsePage(searchParams.page),
  };
}

export function parseCustomerParams(searchParams = {}) {
  const sort = first(searchParams.sort);
  return {
    q: text(searchParams.q),
    sort: ["spent", "orders", "last", "name"].includes(sort) ? sort : "spent",
    dir: first(searchParams.dir) === "asc" ? "asc" : "desc",
    page: parsePage(searchParams.page),
  };
}

export function parseDishParams(searchParams = {}) {
  return {
    q: text(searchParams.q, 100),
    category: normalizeCategory(searchParams.category),
    page: parsePage(searchParams.page),
  };
}

// A link to `basePath` carrying only the values that differ from the defaults, so URLs stay
// short and equal states have equal URLs. `defaults` and `values` are plain objects.
export function listHref(basePath, values, defaults = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined || value === null || value === "") continue;
    if (value === defaults[key]) continue;
    if (key === "page" && value === 1) continue;
    params.set(key, String(value));
  }
  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}

export const ORDER_DEFAULTS = { sort: "date", dir: "desc", page: 1 };
export const CUSTOMER_DEFAULTS = { sort: "spent", dir: "desc", page: 1 };
export const DISH_DEFAULTS = { category: "All", page: 1 };

export { SORT_KEYS, CATEGORIES };
