import { revalidatePath } from "next/cache";
import { authorizeAdmin, adminJson, readJsonBody } from "@/lib/admin-api";
import { updateDish, deleteDish, MenuStorageError } from "@/lib/dishes";

// Admin only.
//   PUT    /api/admin/dishes/:id   → replace the editable fields · 200 { dish } · 404 · 422
//   DELETE /api/admin/dishes/:id   → 200 { deleted: id } · 404 · 409 (the last dish)
//   503 the server's disk is read-only (see ADMIN.md)
// The id in the URL is the dish's id for good; it cannot be changed through the body.
export const dynamic = "force-dynamic";

const DISH_ID = /^[a-z0-9][a-z0-9-]{0,63}$/;

async function run(operation) {
  try {
    const result = await operation();
    if (!result.ok) {
      return adminJson({ error: result.error, ...(result.fieldErrors ? { fieldErrors: result.fieldErrors } : {}) }, result.status);
    }
    revalidatePath("/", "layout");
    return { result };
  } catch (error) {
    if (error instanceof MenuStorageError) return adminJson({ error: error.message }, 503);
    console.error("/api/admin/dishes/[id] failed", error);
    return adminJson({ error: "Something went wrong while saving the dish." }, 500);
  }
}

export async function PUT(request, { params }) {
  const gate = await authorizeAdmin(request, { write: true });
  if (gate.response) return gate.response;

  const parsed = await readJsonBody(request);
  if (parsed.response) return parsed.response;
  if (!DISH_ID.test(params.id)) return adminJson({ error: "Dish not found." }, 404);

  const outcome = await run(() => updateDish(params.id, parsed.body, gate.session));
  return outcome.result ? adminJson({ dish: outcome.result.dish }) : outcome;
}

export async function DELETE(request, { params }) {
  const gate = await authorizeAdmin(request, { write: true });
  if (gate.response) return gate.response;
  if (!DISH_ID.test(params.id)) return adminJson({ error: "Dish not found." }, 404);

  const outcome = await run(() => deleteDish(params.id, gate.session));
  return outcome.result ? adminJson({ deleted: params.id }) : outcome;
}
