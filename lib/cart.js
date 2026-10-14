// Cart cookie helpers. The cart's source of truth is the browser (localStorage,
// see components/Providers.js). A copy of just { id, quantity } is mirrored into
// a cookie whose Path is /checkout, so the browser sends it to the checkout
// route and nowhere else — that is what lets the checkout form work with
// JavaScript switched off. Prices are never stored: the server re-prices.
export const CART_COOKIE = "addis-cart";
export const CART_COOKIE_PATH = "/checkout";

export function serializeCart(items) {
  return JSON.stringify(items.map((item) => ({ id: item.id, quantity: item.quantity })));
}

export function parseCart(raw) {
  if (!raw) return [];
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    try {
      data = JSON.parse(decodeURIComponent(raw));
    } catch {
      return [];
    }
  }
  if (!Array.isArray(data)) return [];
  return data
    .filter((line) => line && typeof line.id === "string" && Number.isInteger(line.quantity) && line.quantity >= 1)
    .map((line) => ({ id: line.id, quantity: line.quantity }));
}
