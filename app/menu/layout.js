import Link from "next/link";
import "./menu.css";

// Nested layout: wraps /menu and /menu/[id]. It persists while the customer
// moves between the list and a dish, and it is static markup — no data, no cookies.
export default function MenuLayout({ children }) {
  return (
    <div className="menu-shell">
      <nav className="container menu-breadcrumb" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <span aria-hidden="true"> / </span>
        <Link href="/menu">Menu</Link>
      </nav>
      {children}
    </div>
  );
}
