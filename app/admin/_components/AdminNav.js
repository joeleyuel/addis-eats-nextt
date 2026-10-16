"use client";
// Client only because it needs the current path to mark the active section (usePathname).
// It is a plain list of links: a sidebar on a wide screen, a row of tabs that scrolls sideways
// on a phone (see admin.css) — no toggle to open, so nothing depends on JavaScript to be reachable.
// Who may SEE these links is not security: every page and API route checks the admin role itself.
import Link from "next/link";
import { usePathname } from "next/navigation";

const SECTIONS = [
  { href: "/admin", label: "Overview", exact: true },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/dishes", label: "Dishes" },
  { href: "/admin/customers", label: "Customers" },
];

// Existing staff screens, one click away.
const SHORTCUTS = [
  { href: "/kitchen", label: "Kitchen" },
  { href: "/dashboard", label: "Staff dashboard" },
];

export default function AdminNav() {
  const pathname = usePathname();
  const isActive = (item) => (item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`));

  return (
    <nav className="admin-nav" aria-label="Admin sections">
      <ul className="admin-nav__list">
        {SECTIONS.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className={`admin-nav__link${isActive(item) ? " is-active" : ""}`}
              aria-current={isActive(item) ? "page" : undefined}
            >
              {item.label}
            </Link>
          </li>
        ))}
        {SHORTCUTS.map((item, index) => (
          <li key={item.href} className={index === 0 ? "admin-nav__divider" : undefined}>
            <Link href={item.href} className="admin-nav__link admin-nav__link--secondary">
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
