// Feature 20 — Delivery Fee Calculator
// Feature 21 — Estimated Delivery Time
// Both are derived from the selected delivery area, not stored on their own.

// `center` is [lat, lng] (Leaflet order) — an APPROXIMATE centre of the neighbourhood,
// used only to place the delivery marker on the tracking map. It is not the customer's
// exact address, and the map says so. `short` is the chart label.
export const DELIVERY_AREAS = [
  { id: "bole", label: "Bole & Medhanialem", short: "Bole", fee: 80, etaMinutes: [25, 35], center: [8.995, 38.7896] },
  { id: "kazanchis", label: "Kazanchis & Guinea Conakry", short: "Kazanchis", fee: 70, etaMinutes: [20, 30], center: [9.0187, 38.7667] },
  { id: "piassa", label: "Piassa & Arada", short: "Piassa", fee: 90, etaMinutes: [30, 40], center: [9.0356, 38.7508] },
  { id: "sarbet", label: "Sarbet & Old Airport", short: "Sarbet", fee: 85, etaMinutes: [25, 35], center: [8.9895, 38.726] },
  { id: "cmc", label: "CMC & Ayat Heights", short: "CMC", fee: 110, etaMinutes: [35, 45], center: [9.017, 38.827] },
];

// Where the demo courier starts (near Meskel Square). Demo data, see lib/tracking.js.
export const KITCHEN = { name: "Addis Eats kitchen (demo)", position: [9.0105, 38.7613] };

export function getDeliveryArea(areaId) {
  return DELIVERY_AREAS.find((area) => area.id === areaId) || null;
}

export function getDeliveryFee(areaId) {
  const area = getDeliveryArea(areaId);
  return area ? area.fee : 0;
}

export function getEstimatedDeliveryTime(areaId) {
  const area = getDeliveryArea(areaId);
  if (!area) return "";
  const [min, max] = area.etaMinutes;
  return `${min}-${max} min`;
}
