// Day 46 — aggregation for the dashboard. It runs on the SERVER, so only a handful of
// summarised rows (five neighbourhoods, thirty days) ever cross to the browser charts,
// never every order. Pure functions over { area, total, createdAt, cancelled }.
// Cancelled orders are not revenue and are not counted as orders.
import { DELIVERY_AREAS } from "./delivery.js";
import { dayKey, dayLabel } from "./format.js";

const DAY_MS = 86_400_000;

export function revenueByArea(orders) {
  return DELIVERY_AREAS.map((area) => {
    const mine = orders.filter((o) => !o.cancelled && o.area === area.id);
    return {
      area: area.short,
      fullName: area.label,
      orders: mine.length,
      revenue: mine.reduce((sum, o) => sum + o.total, 0),
    };
  });
}

// One row per calendar day (Addis Ababa), oldest first, including days with no orders —
// leaving them out would draw a line that skips the quiet days and flatters the trend.
export function ordersPerDay(orders, { days = 30, now = Date.now() } = {}) {
  const rows = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const moment = now - i * DAY_MS; // EAT has no daylight saving, so 24 h steps are safe
    rows.push({ day: dayKey(moment), label: dayLabel.format(new Date(moment)), orders: 0 });
  }
  const byDay = new Map(rows.map((row) => [row.day, row]));
  for (const order of orders) {
    if (order.cancelled) continue;
    const row = byDay.get(dayKey(order.createdAt));
    if (row) row.orders += 1;
  }
  return { rows, from: rows[0].label, to: rows[rows.length - 1].label, days };
}

export function totals(orders) {
  const live = orders.filter((o) => !o.cancelled);
  const revenue = live.reduce((sum, o) => sum + o.total, 0);
  return {
    orders: live.length,
    revenue,
    average: live.length ? Math.round(revenue / live.length) : 0,
    cancelled: orders.length - live.length,
  };
}
