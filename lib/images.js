import "server-only";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { isValidImagePath } from "./dish-validate.js";

// The photos the site can serve (files in public/images), as "/images/<file>" paths, for the
// dish form's suggestions. If the folder cannot be read on this host the list is simply empty:
// the field still accepts a typed path and the server checks it either way.
export async function listDishImages() {
  try {
    const files = await readdir(path.join(process.cwd(), "public", "images"));
    return files
      .map((file) => `/images/${file}`)
      .filter(isValidImagePath)
      .sort((a, b) => a.localeCompare(b));
  } catch {
    return [];
  }
}
