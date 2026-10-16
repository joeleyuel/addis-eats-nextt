// Validates the `next` value that carries "where to go after sign-in".
// It comes from the URL or a form field, so it is attacker-controlled: a link like
//   /signin?next=https://evil.example   or   /signin?next=//evil.example
// must never turn the sign-in page into a redirect to another site (an open redirect).
//
// Accepted: a same-site path such as "/orders" or "/checkout?order=AE-12345".
// Everything else falls back to `fallback`. Pure, no imports: used by the sign-in
// page, the signIn action and the session helper.
export function safeNext(value, fallback = "/") {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 500) return fallback;

  // The sheet's check: must start with a slash (rejects https://… and javascript:…).
  if (!raw.startsWith("/")) return fallback;

  // Starting with a slash is NOT enough: "//evil.example" is protocol-relative and
  // "/\evil.example" is read as "//evil.example" by browsers.
  if (raw.startsWith("//") || raw.startsWith("/\\")) return fallback;

  // Browsers silently strip tabs and newlines from URLs ("/\t/evil.example" becomes
  // "//evil.example"), and backslashes are treated like slashes. Refuse both.
  if (/[\u0000-\u001f\u007f\\]/.test(raw)) return fallback;

  // Belt and braces: resolved against a fixed origin it must stay on that origin.
  try {
    if (new URL(raw, "http://addis-eats.invalid").origin !== "http://addis-eats.invalid") return fallback;
  } catch {
    return fallback;
  }

  // Do not bounce back to the sign-in page itself.
  if (raw === "/signin" || raw.startsWith("/signin?") || raw.startsWith("/signin/")) return fallback;

  return raw;
}

// "/signin?next=…" with the destination encoded.
export function signInUrl(next) {
  return `/signin?next=${encodeURIComponent(safeNext(next))}`;
}

// ---- Admin return links ------------------------------------------------------------------
// The admin console has its own sign-in (/admin/signin) and may only send an admin back to
// somewhere INSIDE /admin. Same open-redirect rules as safeNext, and one more: "/administrator"
// and "/admin/signin" itself are not "inside /admin".
export function safeAdminNext(value) {
  const next = safeNext(value, "/admin");
  const inside = next === "/admin" || next.startsWith("/admin/") || next.startsWith("/admin?");
  const loop = next === "/admin/signin" || next.startsWith("/admin/signin/") || next.startsWith("/admin/signin?");
  return inside && !loop ? next : "/admin";
}

// "/admin/signin?next=…" with the destination encoded (and, optionally, an error code).
export function adminSignInUrl(next, error) {
  const url = `/admin/signin?next=${encodeURIComponent(safeAdminNext(next))}`;
  return error ? `${url}&error=${encodeURIComponent(error)}` : url;
}
