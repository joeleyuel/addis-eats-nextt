// The ONE validation schema for a dish, used in two places (the same pattern as
// lib/validate.js for orders):
//   1. the admin dish form (client) — instant feedback
//   2. POST/PUT /api/admin/dishes — the check that actually counts
// Pure functions, no imports from the server, so both sides can use it.
//
// Only the fields an admin may set are read. `id`, `rating` and `reviews` in a request are
// ignored (an id is made from the name once and never changes, because orders and carts refer
// to it; ratings come from customers, not from the admin).
import { CATEGORIES } from "./categories.js";

export const DISH_CATEGORIES = CATEGORIES.filter((c) => c !== "All");
export const DISH_LIMITS = {
  name: [2, 60],
  price: [1, 100_000],
  prepMinutes: [1, 240],
  shortDescription: [10, 160],
  description: [20, 800],
  ingredientCount: 12,
  ingredient: [2, 60],
  image: 200,
};

// Strips control characters (including newlines and tabs) and collapses runs of spaces.
// React escapes text on output, so this is about tidy data, not about "sanitising HTML".
export function cleanText(value) {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// "Fresh Mango & Avocado Spris" → "fresh-mango-avocado-spris". Letters and digits only
// (accents folded), so an id is always safe in a URL and a file name.
export function slugify(name) {
  return cleanText(name)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

// A dish photo is a file the site itself serves from public/images — not an arbitrary URL.
// (An outside host would also need adding to next.config.mjs.) No "..", no query, no "#".
export function isValidImagePath(value) {
  if (typeof value !== "string" || value.length === 0 || value.length > DISH_LIMITS.image) return false;
  if (!value.startsWith("/images/")) return false;
  if (/[\u0000-\u001f\u007f\\?#%]/.test(value)) return false;
  if (value.split("/").some((part) => part === ".." || part === ".")) return false;
  return /\.(jpe?g|png|webp|avif|gif|svg)$/i.test(value);
}

// "25 mins" → 25 · anything else → null
export function parsePrepMinutes(prepTime) {
  const match = /^\s*(\d{1,3})\s*min/i.exec(String(prepTime ?? ""));
  return match ? Number(match[1]) : null;
}

const toInt = (value) => {
  if (typeof value === "number") return Number.isInteger(value) ? value : NaN;
  if (typeof value === "string" && /^\d{1,7}$/.test(value.trim())) return Number(value.trim());
  return NaN;
};

const toBool = (value) => {
  if (value === undefined || value === null || value === "" || value === false || value === "false") return false;
  if (value === true || value === "true" || value === "on") return true;
  return null; // not a boolean
};

// Ingredients arrive as an array (API) or one per line (the form's textarea).
export function parseIngredients(value) {
  const list = Array.isArray(value) ? value : typeof value === "string" ? value.split(/\r?\n/) : [];
  return list.map((item) => cleanText(item)).filter(Boolean);
}

// Returns { errors, value }. `errors` is { field: message }; `value` is the clean record
// (without id, rating or reviews) and is only meaningful when `errors` is empty.
export function validateDishInput(input) {
  const source = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const errors = {};

  const name = cleanText(source.name);
  const [nameMin, nameMax] = DISH_LIMITS.name;
  if (typeof source.name !== "string" || name.length < nameMin) errors.name = `Enter a name (at least ${nameMin} characters).`;
  else if (name.length > nameMax) errors.name = `Keep the name under ${nameMax} characters.`;
  else if (!slugify(name)) errors.name = "The name needs at least one letter or number.";

  const category = typeof source.category === "string" ? source.category : "";
  if (!DISH_CATEGORIES.includes(category)) errors.category = `Choose a category: ${DISH_CATEGORIES.join(", ")}.`;

  const price = toInt(source.price);
  const [priceMin, priceMax] = DISH_LIMITS.price;
  if (!Number.isInteger(price) || price < priceMin || price > priceMax) {
    errors.price = `Enter a whole price in ETB, from ${priceMin} to ${priceMax.toLocaleString("en-US")}.`;
  }

  // The form sends minutes; the file stores the text the menu already uses ("25 mins").
  const minutes = toInt(source.prepMinutes);
  const [minMin, minMax] = DISH_LIMITS.prepMinutes;
  if (!Number.isInteger(minutes) || minutes < minMin || minutes > minMax) {
    errors.prepMinutes = `Enter the preparation time in whole minutes, from ${minMin} to ${minMax}.`;
  }

  const spicy = toBool(source.spicy);
  if (spicy === null) errors.spicy = "Spicy must be yes or no.";
  const vegan = toBool(source.vegan);
  if (vegan === null) errors.vegan = "Vegan must be yes or no.";

  const image = typeof source.image === "string" ? source.image.trim() : source.image == null ? "" : null;
  if (image === null || (image !== "" && !isValidImagePath(image))) {
    errors.image = "Use a file from the site's images folder, such as /images/Doro Wot Deluxe.jpg, or leave it empty.";
  }

  const shortDescription = cleanText(source.shortDescription);
  const [shortMin, shortMax] = DISH_LIMITS.shortDescription;
  if (shortDescription.length < shortMin) errors.shortDescription = `Write a short description (at least ${shortMin} characters).`;
  else if (shortDescription.length > shortMax) errors.shortDescription = `Keep the short description under ${shortMax} characters.`;

  const description = cleanText(source.description);
  const [descMin, descMax] = DISH_LIMITS.description;
  if (description.length < descMin) errors.description = `Write a description (at least ${descMin} characters).`;
  else if (description.length > descMax) errors.description = `Keep the description under ${descMax} characters.`;

  const ingredients = parseIngredients(source.ingredients);
  const [ingMin, ingMax] = DISH_LIMITS.ingredient;
  if (ingredients.length > DISH_LIMITS.ingredientCount) {
    errors.ingredients = `List at most ${DISH_LIMITS.ingredientCount} ingredients.`;
  } else if (ingredients.some((i) => i.length < ingMin || i.length > ingMax)) {
    errors.ingredients = `Each ingredient needs ${ingMin} to ${ingMax} characters, one per line.`;
  }

  return {
    errors,
    value: {
      name,
      category,
      price,
      prepTime: `${minutes} mins`,
      spicy: spicy === true,
      vegan: vegan === true,
      image: image || "",
      shortDescription,
      description,
      ingredients,
    },
  };
}
