import "server-only";
import { getSession } from "./session.js";
import { isAdminRole } from "./roles.js";

// Shared by every /api/admin/* route handler, so none of them can forget a step.
//
//   const gate = await authorizeAdmin(request);       // GET: 401 / 403
//   const gate = await authorizeAdmin(request, { write: true });  // + same-origin check
//   if (gate.response) return gate.response;
//   const { session } = gate;
//
// The data functions check the role again (lib/orders.js, lib/dishes.js) — this is the front
// door, not the only lock.
const NO_STORE = { "Cache-Control": "no-store" };

export function adminJson(body, status = 200) {
  return Response.json(body, { status, headers: NO_STORE });
}

// A browser always sends Origin on a cross-site write, and sameSite=lax already keeps the
// cookie off it. This is the second lock: if Origin is there it must be OUR host. A request
// with no Origin at all (curl, a server) is allowed unless the browser says it is cross-site.
export function isSameOrigin(request) {
  const origin = request.headers.get("origin");
  const hosts = [request.headers.get("host"), request.headers.get("x-forwarded-host")].filter(Boolean);
  if (origin) {
    try {
      return hosts.includes(new URL(origin).host);
    } catch {
      return false;
    }
  }
  const fetchSite = request.headers.get("sec-fetch-site");
  return !fetchSite || fetchSite === "same-origin" || fetchSite === "none";
}

export async function authorizeAdmin(request, { write = false } = {}) {
  const session = await getSession();
  if (!session) return { response: adminJson({ error: "Sign in as an admin to use this." }, 401) };
  if (!isAdminRole(session.role)) return { response: adminJson({ error: "Admin access required." }, 403) };
  if (write && !isSameOrigin(request)) {
    return { response: adminJson({ error: "Cross-site requests are not allowed." }, 403) };
  }
  return { session };
}

export const MAX_BODY_BYTES = 32 * 1024;

// 415 not JSON · 413 too big · 400 not parseable · otherwise { body } (an object, never null).
export async function readJsonBody(request) {
  const type = (request.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  if (type !== "application/json" && !type.endsWith("+json")) {
    return { response: adminJson({ error: 'Content-Type must be "application/json".' }, 415) };
  }
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    return { response: adminJson({ error: "The request body is too large." }, 413) };
  }
  let text;
  try {
    text = await request.text();
  } catch {
    return { response: adminJson({ error: "Request body could not be read." }, 400) };
  }
  if (text.length > MAX_BODY_BYTES) {
    return { response: adminJson({ error: "The request body is too large." }, 413) };
  }
  try {
    const body = JSON.parse(text);
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("not an object");
    return { body };
  } catch {
    return { response: adminJson({ error: "Request body must be a JSON object." }, 400) };
  }
}
