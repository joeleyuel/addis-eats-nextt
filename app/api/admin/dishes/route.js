import { revalidatePath } from "next/cache";
import { authorizeAdmin, adminJson, readJsonBody } from "@/lib/admin-api";
import { createDish, MenuStorageError } from "@/lib/dishes";

// POST /api/admin/dishes — add a dish to the menu. Admin only.
//   201 { dish } · 422 { error, fieldErrors } · 401 / 403 · 415 / 400 / 413 bad body
//   503 the server's disk is read-only (see ADMIN.md)
// The body is checked by lib/dish-validate.js — the same schema the form uses. An id, a rating
// or a review count in the body is ignored.
export const dynamic = "force-dynamic";

export async function POST(request) {
  const gate = await authorizeAdmin(request, { write: true });
  if (gate.response) return gate.response;

  const parsed = await readJsonBody(request);
  if (parsed.response) return parsed.response;

  try {
    const result = await createDish(parsed.body, gate.session);
    if (!result.ok) {
      return adminJson({ error: result.error, ...(result.fieldErrors ? { fieldErrors: result.fieldErrors } : {}) }, result.status);
    }
    // The menu, the home page, each dish page and the sitemap were built from the old file.
    revalidatePath("/", "layout");
    return adminJson({ dish: result.dish }, 201);
  } catch (error) {
    if (error instanceof MenuStorageError) return adminJson({ error: error.message }, 503);
    console.error("POST /api/admin/dishes failed", error);
    return adminJson({ error: "Something went wrong while saving the dish." }, 500);
  }
}
