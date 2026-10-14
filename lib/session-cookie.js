// The cookie's name and a cheap shape check, in a module with NO imports so the
// edge-runtime middleware can use it (lib/session.js needs node:crypto and
// next/headers, which the edge runtime does not have).
export const SESSION_COOKIE = "addis-session";

// A token is "<base64url payload>.<base64url signature>". This only proves the
// cookie is present and well-formed — it does NOT prove it is genuine. The
// signature is verified later, in lib/session.js, by getSession().
const TOKEN_SHAPE = /^[A-Za-z0-9_-]{10,2000}\.[A-Za-z0-9_-]{20,200}$/;

export function looksLikeSessionToken(value) {
  return typeof value === "string" && TOKEN_SHAPE.test(value);
}
