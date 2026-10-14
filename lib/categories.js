// Shared by the menu page (server) and the category bar (client). Pure data.
export const CATEGORIES = ["All", "Ethiopian", "Pizza", "Burgers", "Drinks"];

// Case-insensitive; anything unknown (or missing) falls back to "All".
export function normalizeCategory(value) {
  const raw = (Array.isArray(value) ? value[0] : value) || "";
  return CATEGORIES.find((c) => c.toLowerCase() === String(raw).toLowerCase()) || "All";
}
