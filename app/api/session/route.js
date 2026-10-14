import { getSession } from "@/lib/session";

// GET /api/session — who is signed in, for the header only (which links to show).
// Name and role are all it returns: never the phone number, the user id or the token.
// Always 200: "nobody" is an answer, not an error. Never cached.
export async function GET() {
  const session = await getSession();
  return Response.json(
    { user: session ? { name: session.name, role: session.role } : null },
    { headers: { "Cache-Control": "no-store" } }
  );
}
