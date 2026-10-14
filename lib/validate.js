// The ONE validation schema. It runs in three places:
//   1. the checkout form (client) — instant feedback once a field is touched
//   2. the placeOrder server action — the check that actually counts
//   3. POST /api/orders — the same rules for anything outside our pages
// Pure functions: no React, no server-only imports, so both sides can import it.
import { getDeliveryArea } from "./delivery.js";

export const MAX_QUANTITY = 50;
export const MAX_LINES = 30;
export const MAX_INSTRUCTIONS = 300;

export function isValidEthiopianPhone(value) {
  const digits = (value || "").replace(/\D/g, "");
  return /^(09|07)\d{8}$/.test(digits) || /^2519\d{8}$/.test(digits) || /^2517\d{8}$/.test(digits);
}

// 0911234567, 0911 234 567 and +251 911 234 567 are the same person.
export function normalizePhone(value) {
  const digits = (value || "").replace(/\D/g, "");
  return digits.startsWith("251") ? `0${digits.slice(3)}` : digits;
}

// Name and phone are shared by the sign-in guard and the checkout form.
export function validateContact(fields) {
  const errors = {};

  if (!fields.name || fields.name.trim().length < 2) {
    errors.name = "Enter your full name (at least 2 characters).";
  } else if (fields.name.trim().length > 80) {
    errors.name = "Keep the name under 80 characters.";
  }

  if (!isValidEthiopianPhone(fields.phone)) {
    errors.phone = "Enter a valid Ethiopian mobile number, e.g. 0911 234 567.";
  }

  return errors;
}

// Carried over from Day 35 (name, phone, area, address), plus the checks a
// server must make that a browser form can skip: known area, bounded text.
export function validateCheckoutForm(fields) {
  const errors = validateContact(fields);

  if (!fields.area || !getDeliveryArea(fields.area)) {
    errors.area = "Choose a delivery sub-city or neighborhood.";
  }

  if (!fields.address || fields.address.trim().length < 5) {
    errors.address = "Add a building, house number, or landmark.";
  } else if (fields.address.trim().length > 200) {
    errors.address = "Keep the address under 200 characters.";
  }

  if (fields.instructions && fields.instructions.length > MAX_INSTRUCTIONS) {
    errors.instructions = `Keep special instructions under ${MAX_INSTRUCTIONS} characters.`;
  }

  return errors;
}

// Order lines are { id, quantity }. Prices never come from the client.
export function validateOrderItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return "Your order has no dishes in it.";
  }
  if (items.length > MAX_LINES) {
    return `An order can have at most ${MAX_LINES} different dishes.`;
  }
  const seen = new Set();
  for (const line of items) {
    const validShape =
      line &&
      typeof line.id === "string" &&
      line.id.length > 0 &&
      Number.isInteger(line.quantity) &&
      line.quantity >= 1 &&
      line.quantity <= MAX_QUANTITY;
    if (!validShape) {
      return `Each dish needs an id and a whole quantity from 1 to ${MAX_QUANTITY}.`;
    }
    if (seen.has(line.id)) return "Each dish may appear only once in an order.";
    seen.add(line.id);
  }
  return null;
}

// The full order schema. Returns { name?, phone?, area?, address?, instructions?, items? }.
export function validateOrder(input) {
  const source = input && typeof input === "object" ? input : {};
  const text = (v) => (typeof v === "string" ? v : "");
  const errors = validateCheckoutForm({
    name: text(source.name),
    phone: text(source.phone),
    area: text(source.area),
    address: text(source.address),
    instructions: text(source.instructions),
  });
  const itemsError = validateOrderItems(source.items);
  if (itemsError) errors.items = itemsError;
  return errors;
}
