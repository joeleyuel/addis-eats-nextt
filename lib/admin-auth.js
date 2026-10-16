import "server-only";
import crypto from "node:crypto";
import { redirect, notFound } from "next/navigation";
import { getSession } from "./session.js";
import { normalizePhone } from "./validate.js";
import { adminSignInUrl } from "./safe-next.js";
import { isAdminRole } from "./roles.js";
import { createLimiter } from "./rate-limit.js";

// Who may open /admin, and how they prove it.
//
// The normal sign-in (a name and a phone number, no password) is a coursework mock, and
// STAFF_PHONES is protected by nothing but knowing a number. That is not good enough for a
// console that can delete dishes and change every order. So the admin role needs TWO things,
// both read from the server's environment and never sent to the browser:
//   ADMIN_PHONES       comma-separated phone numbers allowed to be admins
//   ADMIN_ACCESS_CODE  a long random secret, typed on /admin/signin (>= 12 characters)
// Neither is set → admin sign-in is switched off (fail closed). See ADMIN.md.
export const MIN_ACCESS_CODE_LENGTH = 12;

export function adminConfig() {
  const code = process.env.ADMIN_ACCESS_CODE || "";
  const phones = (process.env.ADMIN_PHONES || "")
    .split(",")
    .map((p) => normalizePhone(p.trim()))
    .filter(Boolean);
  return { code, phones, enabled: code.length >= MIN_ACCESS_CODE_LENGTH && phones.length > 0 };
}

const sha256 = (value) => crypto.createHash("sha256").update(value).digest();

// True only for a listed phone AND the right code. Both checks always run (and the code is
// compared as two equal-length hashes with timingSafeEqual), so how long it takes says nothing
// about which part was wrong.
export function verifyAdminCredentials({ phone, code }) {
  const config = adminConfig();
  const given = sha256(typeof code === "string" ? code : "");
  const expected = sha256(config.code || "not-configured");
  const codeOk = crypto.timingSafeEqual(given, expected) && config.enabled;
  const phoneOk = config.phones.includes(normalizePhone(phone));
  return codeOk && phoneOk;
}

// Failed admin sign-ins, counted per client address AND per phone number. The phone key is
// what holds if someone spoofs X-Forwarded-For to dodge the address key.
export const adminLoginLimiter = (globalThis.__addisEatsAdminLimiter ??= {
  ip: createLimiter({ max: 5, windowMs: 15 * 60 * 1000 }),
  phone: createLimiter({ max: 10, windowMs: 15 * 60 * 1000 }),
});

// The caller's address as best the server can tell. Only a hint for the limiter above, never
// for authorisation.
export function clientIp(headerGet) {
  const forwarded = headerGet("x-forwarded-for");
  const first = typeof forwarded === "string" ? forwarded.split(",")[0].trim() : "";
  return (first || headerGet("x-real-ip") || "unknown").slice(0, 64);
}

// For admin PAGES (layer 2), called by EVERY page under /admin — not only the layout, because
// Next.js does not re-run a layout when you move between pages inside it.
//   signed out        → /admin/signin, and back here afterwards
//   signed in, not admin → the same 404 as any unknown URL (the console is not advertised)
export async function requireAdmin(nextPath = "/admin") {
  const session = await getSession();
  if (!session) redirect(adminSignInUrl(nextPath));
  if (!isAdminRole(session.role)) notFound();
  return session;
}
