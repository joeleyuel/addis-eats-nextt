import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { safeNext } from "@/lib/safe-next";
import SignInPanel from "./SignInPanel";
import "../checkout/checkout.css";

// /signin accepts ?next= and ?error=, so it declares a canonical URL.
export const metadata = {
  title: "Sign in",
  description: "Sign in with your name and Ethiopian mobile number to place an order and follow its delivery.",
  alternates: { canonical: "/signin" },
};

// Dynamic (ƒ): it reads the session cookie and the query string.
export const dynamic = "force-dynamic";

// /signin?next=/orders — `next` is where the visitor was going (set by middleware
// or by a page-level check). It is validated here before it is put in the form, and
// again inside the signIn action: a crafted link such as ?next=https://evil.example
// or ?next=//evil.example becomes "/".
export default async function SignInPage({ searchParams }) {
  const next = safeNext(searchParams.next);

  // Already signed in: nothing to do here.
  if (await getSession()) redirect(next);

  const error = typeof searchParams.error === "string" ? searchParams.error : "";
  return <SignInPanel error={error} next={next} />;
}
