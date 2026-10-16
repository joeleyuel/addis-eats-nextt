// Server component: a plain <form action={adminSignIn}> that works without client JavaScript.
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { adminConfig } from "@/lib/admin-auth";
import { safeAdminNext } from "@/lib/safe-next";
import { isAdminRole } from "@/lib/roles";
import { adminSignIn } from "../actions";
import Button from "@/components/Button";
import Field from "@/app/checkout/Field";
import "@/app/checkout/checkout.css";

export const metadata = {
  title: "Admin sign-in",
  description: "Sign in to the Addis Eats admin console.",
  robots: { index: false, follow: false },
};

// Dynamic (ƒ): it reads the session cookie and the query string.
export const dynamic = "force-dynamic";

// Only these codes are ever shown. Text from the URL is never printed, so a crafted link cannot
// put words in the form's mouth.
const MESSAGES = {
  invalid: "Those details were not accepted. Check your name, phone number and access code.",
  locked: "Too many attempts. Wait a few minutes before trying again.",
  off: "Admin sign-in is not set up on this server. Set ADMIN_PHONES and ADMIN_ACCESS_CODE (see ADMIN.md), then restart.",
};

export default async function AdminSignInPage({ searchParams }) {
  const next = safeAdminNext(searchParams.next);

  // Already an admin: nothing to do here. (A signed-in CUSTOMER still sees the form, so an
  // admin who is signed in as a customer can step up.)
  const session = await getSession();
  if (session && isAdminRole(session.role)) redirect(next);

  const error = typeof searchParams.error === "string" ? MESSAGES[searchParams.error] : "";
  const configured = adminConfig().enabled;

  return (
    <div className="container section checkout-page">
      <h1>Admin sign-in</h1>
      <form className="checkout-form signin-panel" action={adminSignIn} noValidate>
        <input type="hidden" name="next" value={next} />
        <section className="checkout-section">
          <h2>Sign in to the admin console</h2>
          <p className="signin-panel__lead">
            For the owner and the people they have named. You need your phone number and the admin access code.
          </p>
          {(error || !configured) && (
            <p className="field-error" role="alert">
              <span aria-hidden="true">⚠ </span>
              {error || MESSAGES.off}
            </p>
          )}
          <Field label="Full name" htmlFor="admin-name">
            <input id="admin-name" name="name" type="text" autoComplete="name" required />
          </Field>
          <Field label="Ethiopian mobile number" htmlFor="admin-phone">
            <input id="admin-phone" name="phone" type="tel" placeholder="0911 234 567" autoComplete="tel" required />
          </Field>
          <Field label="Admin access code" htmlFor="admin-code">
            <input id="admin-code" name="code" type="password" autoComplete="current-password" required />
          </Field>
        </section>
        <Button type="submit" variant="primary" size="lg" className="btn--full" disabled={!configured}>
          Sign in
        </Button>
      </form>
    </div>
  );
}
