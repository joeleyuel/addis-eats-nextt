// Day 47 — positions for the delivery map. Pure helpers, no imports from the server.
//
// HONESTY NOTE: Addis Eats has no courier app or GPS feed. Order status is already
// derived from the order's age (lib/orders.js › getStatus), and the courier marker is
// derived the same way: it moves in a straight line from the kitchen to the centre of
// the delivery area during a short demo ride. The UI says so wherever it is shown.
export const DEMO_RIDE_SECONDS = 120;
export const ON_THE_WAY_AFTER_SECONDS = 90; // keep in step with getStatus()

// Seconds into the ride, 0..1. Zero before the courier leaves.
export function rideProgress(ageSeconds) {
  const t = (ageSeconds - ON_THE_WAY_AFTER_SECONDS) / DEMO_RIDE_SECONDS;
  return Math.min(1, Math.max(0, t));
}

// [lat, lng] — Leaflet order. (GeoJSON is [lng, lat]; mixing them puts Bole in the
// Indian Ocean.)
export function lerpPosition(from, to, t) {
  return [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t];
}

// Rough bounds of Addis Ababa, used to catch a reversed pair in tests.
export function isInAddis([lat, lng]) {
  return lat > 8.8 && lat < 9.2 && lng > 38.6 && lng < 39.0;
}
