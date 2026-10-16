// The admin console shell: who is signed in, the section navigation, sign out.
//
// IMPORTANT: this layout checks the admin role, but that is NOT what protects the pages. Next.js
// does not re-run a layout when you move between two pages inside it, so every page under
// /admin calls requireAdmin() itself, and every data function and /api/admin handler checks the
// role again. This check only keeps the shell from rendering for the wrong person.
import { requireAdmin } from "@/lib/admin-auth";
import { signOut } from "@/app/actions";
import AdminNav from "../_components/AdminNav";
import "@/components/DataTable.css";
import "@/app/dashboard/dashboard.css";
import "../admin.css";

export const metadata = {
  title: { template: "%s · Admin · Addis Eats", default: "Admin · Addis Eats" },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }) {
  const session = await requireAdmin("/admin");

  return (
    <div className="container section admin-shell">
      <aside className="admin-side" aria-label="Admin">
        <p className="admin-side__who">
          <span className="admin-side__badge">Admin</span>
          <span>
            Signed in as <strong>{session.name.trim().split(" ")[0]}</strong>
          </span>
        </p>
        <AdminNav />
        <form action={signOut} className="admin-side__signout">
          <button type="submit" className="admin-side__signout-btn">
            Sign out
          </button>
        </form>
      </aside>
      <div className="admin-main">{children}</div>
    </div>
  );
}
