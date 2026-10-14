"use client";
// Client because of the hamburger state, the active-link highlight (usePathname) and
// the sign-in state. The layout itself still reads no cookie (see STRATEGY.md): who is
// signed in comes from GET /api/session after hydration, so every page stays as static
// as it was. The server decides what a visitor may OPEN; this only decides which links
// to show.
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import useSWR from "swr";
import { useCart } from "./Providers";
import { fetcher } from "@/lib/fetcher";
import { signOut } from "@/app/actions";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/menu", label: "Explore Menu" },
  // Private: a signed-out visitor is sent to /signin?next=/orders by middleware and
  // returns here after signing in. The link itself stays static.
  { href: "/orders", label: "My orders" },
];

// Staff only. Shown from the session, but only a convenience: both routes refuse
// non-staff on the server whether or not a link exists.
const STAFF_LINKS = [
  { href: "/kitchen", label: "Kitchen" },
  { href: "/dashboard", label: "Dashboard" },
];

export default function SiteHeader() {
  const { itemCount } = useCart();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const buttonRef = useRef(null);
  const headerRef = useRef(null);

  // undefined = still asking · null = signed out · { name, role } = signed in
  const { data, mutate } = useSWR("/api/session", fetcher, {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  });
  const user = data ? data.user : undefined;

  // The header lives in the layout, so it survives navigation: ask again after every
  // route change, or it would still show "Sign out" after signing out.
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    mutate();
  }, [pathname, mutate]);

  // Close the menu when the route changes (a link was followed, or the back button used).
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // Escape closes it and puts focus back on the button; a press or tap outside closes it.
  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        buttonRef.current?.focus();
      }
    };
    const onPointerDown = (event) => {
      if (headerRef.current && !headerRef.current.contains(event.target)) setMenuOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [menuOpen]);

  const isActive = (href) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const links = user?.role === "staff" ? [...NAV_LINKS, ...STAFF_LINKS] : NAV_LINKS;
  const close = () => setMenuOpen(false);

  return (
    <header className="site-header" ref={headerRef}>
      <div className="container site-header__inner">
        <Link href="/" className="brand">
          <span aria-hidden="true">🍲</span> Addis Eats
        </Link>
        <span className="brand-location">📍 Bole, Addis Ababa</span>

        <button
          ref={buttonRef}
          className={`hamburger ${menuOpen ? "is-open" : ""}`}
          type="button"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          aria-controls="primary-navigation"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span />
          <span />
          <span />
        </button>

        <nav id="primary-navigation" className={`site-nav ${menuOpen ? "site-nav--open" : ""}`} aria-label="Primary">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`site-nav__link${isActive(link.href) ? " active" : ""}`}
              aria-current={isActive(link.href) ? "page" : undefined}
              onClick={close}
            >
              {link.label}
            </Link>
          ))}

          <div className="site-nav__account">
            {user === undefined && <span className="site-nav__account-placeholder" aria-hidden="true" />}
            {user === null && (
              <Link href="/signin" className="site-nav__link site-nav__signin" onClick={close}>
                Sign in
              </Link>
            )}
            {user && (
              <>
                <span className="user-chip">{user.name.trim().split(" ")[0]}</span>
                <form action={signOut}>
                  <button type="submit" className="site-nav__signout">
                    Sign out
                  </button>
                </form>
              </>
            )}
          </div>
        </nav>

        <div className="site-header__actions">
          <Link
            href="/cart"
            className="cart-link"
            aria-label={itemCount > 0 ? `View cart, ${itemCount} ${itemCount === 1 ? "item" : "items"}` : "View cart"}
          >
            <span aria-hidden="true">🛍️</span>
            {itemCount > 0 && (
              <span className="cart-badge" aria-hidden="true">
                {itemCount}
              </span>
            )}
          </Link>
        </div>
      </div>
    </header>
  );
}
