import "server-only";
import { cache } from "react";
import { readFile, writeFile, rename, rm } from "node:fs/promises";
import path from "node:path";
import { isAdminRole } from "./roles.js";
import { slugify, validateDishInput } from "./dish-validate.js";

// The one place that knows where dishes live. Server components call these
// directly — no HTTP hop to our own /api/dishes.
// MENU_DATA_FILE exists for tests (so they never touch the real menu); leave it unset.
const menuFile = () => process.env.MENU_DATA_FILE || path.join(process.cwd(), "data", "menu-data.json");

async function readMenu() {
  const data = JSON.parse(await readFile(menuFile(), "utf8"));
  if (!Array.isArray(data)) {
    throw new Error("The menu data is malformed.");
  }
  return data;
}

export const getDishes = cache(readMenu);

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

// ---- Writes (admin only, Day 50: /admin) ---------------------------------------------------
// The menu is a JSON file, so "persistence" here means rewriting that file. That works when the
// server has a writable disk (`npm run dev`, `npm start` on a VPS or container). It does NOT
// work on a read-only host such as Vercel's serverless functions: there the write fails and the
// admin gets a clear 503 instead of a fake success. A database is the real fix (see ADMIN.md).
//
// Safe against the usual file problems: writes go through one queue (two admins saving at once
// cannot overwrite each other), the new file is written beside the old one and renamed into
// place (a crash mid-write cannot leave half a menu), and every write re-reads the file first
// (never trusting a stale copy).
export class MenuStorageError extends Error {
  constructor(message) {
    super(message);
    this.name = "MenuStorageError";
  }
}

let queue = Promise.resolve();
function exclusive(task) {
  const run = queue.then(task);
  queue = run.catch(() => {});
  return run;
}

async function saveMenu(dishes) {
  const file = menuFile();
  const temp = `${file}.${process.pid}.tmp`;
  try {
    await writeFile(temp, `${JSON.stringify(dishes, null, 2)}\n`, "utf8");
    await rename(temp, file);
  } catch (error) {
    await rm(temp, { force: true }).catch(() => {});
    if (["EROFS", "EACCES", "EPERM", "ENOSPC"].includes(error?.code)) {
      throw new MenuStorageError(
        "The menu file cannot be written on this server (read-only or full disk). Dish changes need a host with a writable disk or a database."
      );
    }
    throw error;
  }
}

const denied = (session) =>
  !session
    ? { ok: false, status: 401, error: "Sign in first." }
    : !isAdminRole(session.role)
      ? { ok: false, status: 403, error: "Admin access required." }
      : null;

const sameName = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();

function uniqueId(name, dishes) {
  const base = slugify(name) || "dish";
  const taken = new Set(dishes.map((d) => d.id));
  if (!taken.has(base)) return base;
  for (let n = 2; ; n += 1) {
    const candidate = `${base}-${n}`.slice(0, 64);
    if (!taken.has(candidate)) return candidate;
  }
}

// Field order mirrors data/menu-data.json so the file stays easy to read in a diff.
function newDishRecord(id, value) {
  return {
    id,
    name: value.name,
    category: value.category,
    price: value.price,
    rating: 0,
    reviews: 0,
    prepTime: value.prepTime,
    spicy: value.spicy,
    vegan: value.vegan,
    image: value.image,
    shortDescription: value.shortDescription,
    description: value.description,
    ingredients: value.ingredients,
  };
}

// Every function answers { ok, status, dish?, fieldErrors?, error? } — never throws for a
// bad request; only a storage failure throws (MenuStorageError, answered 503 by the handlers).
export async function createDish(input, session) {
  const refused = denied(session);
  if (refused) return refused;
  const { errors, value } = validateDishInput(input);
  if (Object.keys(errors).length) return { ok: false, status: 422, error: "The dish has invalid fields.", fieldErrors: errors };

  return exclusive(async () => {
    const dishes = await readMenu();
    if (dishes.some((d) => sameName(d.name, value.name))) {
      return { ok: false, status: 422, error: "The dish has invalid fields.", fieldErrors: { name: "A dish with this name is already on the menu." } };
    }
    const dish = newDishRecord(uniqueId(value.name, dishes), value);
    await saveMenu([...dishes, dish]);
    return { ok: true, status: 201, dish };
  });
}

export async function updateDish(id, input, session) {
  const refused = denied(session);
  if (refused) return refused;
  const { errors, value } = validateDishInput(input);
  if (Object.keys(errors).length) return { ok: false, status: 422, error: "The dish has invalid fields.", fieldErrors: errors };

  return exclusive(async () => {
    const dishes = await readMenu();
    const index = dishes.findIndex((d) => d.id === id);
    if (index === -1) return { ok: false, status: 404, error: "Dish not found." };
    if (dishes.some((d) => d.id !== id && sameName(d.name, value.name))) {
      return { ok: false, status: 422, error: "The dish has invalid fields.", fieldErrors: { name: "Another dish already has this name." } };
    }
    // Keep id, rating, reviews and anything else the file has; replace what the admin may set.
    const dish = { ...dishes[index], ...value };
    const next = [...dishes];
    next[index] = dish;
    await saveMenu(next);
    return { ok: true, status: 200, dish };
  });
}

export async function deleteDish(id, session) {
  const refused = denied(session);
  if (refused) return refused;

  return exclusive(async () => {
    const dishes = await readMenu();
    const dish = dishes.find((d) => d.id === id);
    if (!dish) return { ok: false, status: 404, error: "Dish not found." };
    if (dishes.length === 1) {
      return { ok: false, status: 409, error: "Keep at least one dish on the menu." };
    }
    await saveMenu(dishes.filter((d) => d.id !== id));
    return { ok: true, status: 200, dish };
  });
}
