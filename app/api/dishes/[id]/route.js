import { getDishById } from "@/lib/dishes";

// GET /api/dishes/:id — one dish, or a JSON 404 (not an HTML page) for an
// unknown id, so API clients can parse the failure.
export async function GET(_request, { params }) {
  const dish = await getDishById(params.id);
  if (!dish) {
    return Response.json({ error: `No dish with id "${params.id}".` }, { status: 404 });
  }
  return Response.json(dish);
}
