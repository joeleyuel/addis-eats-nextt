// Server component. A plain <form action={serverAction}> works without any
// client JavaScript at all. (Moved here from app/checkout on Day 42: sign-in is now
// its own route, /signin, which middleware sends signed-out visitors to.)
import Link from "next/link";
import { signIn } from "@/app/actions";
import Button from "@/components/Button";
import Field from "../checkout/Field";

export default function SignInPanel({ error, next }) {
  return (
    <div className="container section checkout-page">
      <h1>Sign in</h1>
      <form className="checkout-form signin-panel" action={signIn} noValidate>
        {/* Already validated by the page; the signIn action validates it again. */}
        <input type="hidden" name="next" value={next} />
        <section className="checkout-section">
          <h2>Sign in to continue</h2>
          <p className="signin-panel__lead">
            Use your name and Ethiopian mobile number. Your cart is kept while you sign in.
          </p>
          {error && (
            <p className="field-error" role="alert">
              <span aria-hidden="true">⚠ </span>
              {error}
            </p>
          )}
          <Field label="Full name" htmlFor="signin-name">
            <input id="signin-name" name="name" type="text" autoComplete="name" required />
          </Field>
          <Field label="Ethiopian mobile number" htmlFor="signin-phone">
            <input
              id="signin-phone"
              name="phone"
              type="tel"
              placeholder="0911 234 567"
              autoComplete="tel"
              required
            />
          </Field>
        </section>
        <Button type="submit" variant="primary" size="lg" className="btn--full">
          Sign in
        </Button>
        <Link href="/menu" className="cart-summary__continue">
          ← Back to menu
        </Link>
      </form>
    </div>
  );
}
