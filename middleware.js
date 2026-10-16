// Layer 1 of 3 (see AUTH.md): a fast, cheap redirect that runs BEFORE any page,
// layout or handler for the private paths. It checks that a well-formed session
// cookie EXISTS — nothing more. It cannot tell whether the cookie is genuine,
// whose it is, or what that person may do: edge middleware cannot use node:crypto
// or the order store, and it should stay tiny. Pages, actions and handlers verify
// the session for real with getSession().
import { NextResponse } from "next/server";
import { SESSION_COOKIE, looksLikeSessionToken } from "@/lib/session-cookie";

export function middleware(request) {
  const { pathname } = request.nextUrl;
  const isAdminArea = pathname === "/admin" || pathname.startsWith("/admin/");

  // The admin sign-in page itself must stay reachable without a cookie.
  if (isAdminArea && pathname.replace(/\/+$/, "") === "/admin/signin") return NextResponse.next();

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!looksLikeSessionToken(token)) {
    // Remember the destination. The sign-in page and action validate it again.
    // /admin has its own sign-in (it needs the admin access code); everything else uses /signin.
    const url = new URL(isAdminArea ? "/admin/signin" : "/signin", request.url);
    url.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

// Admin (Day 50): this layer only sends a cookie-less visitor to /admin/signin. Whether the
// cookie is genuine AND belongs to an admin is checked by every admin page (requireAdmin) and
// every /api/admin handler (authorizeAdmin) — never here.
//
// Narrow on purpose: only the private paths. It does not run for images, static
// files, the menu, the sign-in page itself or /api (the handlers answer 401 JSON
// instead of redirecting).
export const config = {
  matcher: ["/checkout/:path*", "/orders/:path*", "/kitchen/:path*", "/dashboard/:path*", "/admin/:path*"],
};
