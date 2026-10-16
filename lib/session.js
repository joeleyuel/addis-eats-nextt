import "server-only";
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { normalizePhone } from "./validate.js";
import { SESSION_COOKIE } from "./session-cookie.js";
import { signInUrl } from "./safe-next.js";
import { ROLES } from "./roles.js";

// ONE helper, used by pages, server actions and route handlers alike:
//   const session = await getSession();   // { uid, name, phone, role, jti } or null
// If the scheme ever changes, this file is the only place that changes.
//
// The scheme (Day 40's mock sign-in, hardened on Day 42): the cookie holds a SIGNED
// TOKEN — claims + HMAC-SHA256. The browser cannot read it (httpOnly) or forge it
// (signature). It is valid for 8 hours and can ALSO be revoked early: signing out
// records the token id, so a copied cookie stops working at once.
//
// This module reads cookies, which makes any route that imports it dynamic.
export { SESSION_COOKIE };
const MAX_AGE_SECONDS = 60 * 60 * 8;
// An admin session is deliberately shorter: it can change the menu and every order.
export const ADMIN_MAX_AGE_SECONDS = 60 * 60 * 4;

// Revoked token ids → their expiry. In memory, like the order store: enough for a
// single `next start` process and the demo; a real app would use a database table.
const revoked = (globalThis.__addisEatsRevoked ??= new Map());

function getSecret() {
  const secret = process.env.SESSION_SECRET;
  if (secret && secret.length >= 16) return secret;
  if (process.env.NODE_ENV !== "production") return "dev-only-secret-not-for-production";
  throw new Error("SESSION_SECRET is missing or shorter than 16 characters. Copy .env.example to .env.local.");
}

function sign(payload) {
  return crypto.createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

// Role is decided HERE, on the server, from configuration — never from anything the
// sign-in form sends. STAFF_PHONES is a comma-separated list of staff phone numbers.
// This can only ever return "customer" or "staff": the "admin" role is not reachable
// from a phone number. It is issued by lib/admin-auth.js after the access code is
// checked (see createSessionToken's `admin` option).
export function roleForPhone(phone) {
  const staff = (process.env.STAFF_PHONES || "")
    .split(",")
    .map((p) => normalizePhone(p.trim()))
    .filter(Boolean);
  return staff.includes(normalizePhone(phone)) ? "staff" : "customer";
}

// `admin: true` is passed ONLY by the admin sign-in action, after verifyAdminCredentials.
// It is a function argument, never read from a request, a cookie or a form.
export function createSessionToken({ name, phone }, now = Date.now(), { admin = false } = {}) {
  // The id is derived from the phone number, so signing in again as the same
  // customer finds the same orders.
  const uid = crypto.createHash("sha256").update(normalizePhone(phone)).digest("hex").slice(0, 24);
  const claims = {
    uid,
    name: name.trim(),
    phone: phone.trim(),
    role: admin ? "admin" : roleForPhone(phone),
    jti: crypto.randomBytes(12).toString("base64url"),
    exp: Math.floor(now / 1000) + (admin ? ADMIN_MAX_AGE_SECONDS : MAX_AGE_SECONDS),
  };
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

// Verifies signature, shape and expiry, and checks the revocation list.
// Returns { uid, name, phone, role, jti } or null.
export function readSessionToken(token, now = Date.now()) {
  if (typeof token !== "string") return null;
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra !== undefined) return null;

  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return null;

  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    const wellFormed =
      typeof data.uid === "string" &&
      typeof data.name === "string" &&
      typeof data.phone === "string" &&
      ROLES.includes(data.role) &&
      typeof data.jti === "string" &&
      Number.isFinite(data.exp);
    if (!wellFormed) return null;
    if (data.exp * 1000 <= now) return null; // expired
    if (revoked.has(data.jti)) return null; // signed out
    return { uid: data.uid, name: data.name, phone: data.phone, role: data.role, jti: data.jti };
  } catch {
    return null;
  }
}

// THE session helper. Async so every caller already awaits it (cookies() is async
// in newer Next.js versions).
export async function getSession() {
  return readSessionToken(cookies().get(SESSION_COOKIE)?.value);
}

// For private PAGES (layer 2): a signed-out visitor is sent to /signin and comes
// back to `nextPath` afterwards. Middleware already did the cheap version of this;
// this one actually verifies the session.
export async function requireSession(nextPath) {
  const session = await getSession();
  if (!session) redirect(signInUrl(nextPath));
  return session;
}

// httpOnly: scripts cannot read it · secure: HTTPS only · sameSite: not sent from
// other sites. `secure` is on in production builds; it is off in `next dev` only
// because plain http://localhost would not store it in every browser. Set
// COOKIE_SECURE=false to serve a production build over plain http on a LAN.
function cookieOptions(maxAge) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production" && process.env.COOKIE_SECURE !== "false",
    sameSite: "lax",
    path: "/",
    maxAge,
  };
}

export async function startSession(user, { admin = false } = {}) {
  cookies().set(
    SESSION_COOKIE,
    createSessionToken(user, Date.now(), { admin }),
    cookieOptions(admin ? ADMIN_MAX_AGE_SECONDS : MAX_AGE_SECONDS)
  );
}

// Clears the cookie AND invalidates the session on the server.
export async function endSession() {
  const current = await getSession();
  if (current) {
    const now = Date.now();
    for (const [jti, exp] of revoked) if (exp * 1000 <= now) revoked.delete(jti); // tidy up
    // Remember it until the token would have expired anyway.
    revoked.set(current.jti, Math.floor(now / 1000) + MAX_AGE_SECONDS);
  }
  cookies().set(SESSION_COOKIE, "", cookieOptions(0));
}
