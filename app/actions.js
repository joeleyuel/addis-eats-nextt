"use server";
// Server actions: writes triggered from our own UI. Every one of them is a
// public POST endpoint, so every one re-checks who is asking INSIDE the action
// — never in the component that happens to render the button, and never because
// middleware let the request through (middleware only proved a cookie existed).
//
// Layer 3 of 3 (see AUTH.md): authentication ("who are you?") and, for writes to an
// existing record, authorisation ("is it yours?") — both before anything changes.
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSession, startSession, endSession } from "@/lib/session";
import { createOrder, cancelOrderFor, priceLines } from "@/lib/orders";
import { validateContact } from "@/lib/validate";
import { safeNext, signInUrl } from "@/lib/safe-next";
import { CART_COOKIE, CART_COOKIE_PATH, parseCart } from "@/lib/cart";

const text = (formData, key) => {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
};

// Sign in with a name and an Ethiopian mobile number (mock, as on Day 35: there is
// no password — see AUTH.md). `next` is where to go afterwards; it arrives from the
// URL via a hidden field, so it is untrusted and validated here, not only on the page.
export async function signIn(formData) {
  const next = safeNext(text(formData, "next"));
  const fields = { name: text(formData, "name"), phone: text(formData, "phone") };
  const errors = validateContact(fields);
  const message = [errors.name, errors.phone].filter(Boolean).join(" ");
  if (message) {
    redirect(`${signInUrl(next)}&error=${encodeURIComponent(message)}`);
  }
  await startSession(fields);
  redirect(next);
}

// Clears the cookie and revokes the session on the server (lib/session.js).
export async function signOut() {
  await endSession();
  redirect("/");
}

// Place the order. Used with useFormState, so it receives the previous state.
// Returns { message, errors, values } on failure; redirects on success.
export async function placeOrder(prevState, formData) {
  const values = {
    name: text(formData, "name"),
    phone: text(formData, "phone"),
    area: text(formData, "area"),
    address: text(formData, "address"),
    instructions: text(formData, "instructions"),
  };

  // 1. Authentication — checked here, from the signed cookie. The order is then
  //    owned by THIS session; no owner id is ever read from the request.
  const session = await getSession();
  if (!session) {
    return { message: "Please sign in to place an order.", errors: {}, values };
  }

  // 2. The cart comes from the cart cookie and is re-priced from OUR menu.
  const cart = await priceLines(parseCart(cookies().get(CART_COOKIE)?.value));
  const items = cart.lines.map(({ id, quantity }) => ({ id, quantity }));

  // 3. Validation — the same schema the form and the API use.
  const result = await createOrder({ ...values, items }, session);
  if (!result.ok) {
    return {
      message: result.fieldErrors?.items || (result.status === 422 ? "Please fix the highlighted fields." : result.error),
      errors: result.fieldErrors || {},
      values,
    };
  }

  cookies().set(CART_COOKIE, "[]", { path: CART_COOKIE_PATH, maxAge: 0 });
  redirect(`/checkout?order=${encodeURIComponent(result.order.id)}`);
}

// Cancel an order. The order id comes from the client, so it proves nothing:
//   not signed in  → 401, nothing changes (and the visitor is sent to sign in)
//   not your order → indistinguishable from "no such order" (404), nothing changes
// Both are decided by cancelOrderFor against the session, before the write.
export async function cancelOrder(formData) {
  const id = text(formData, "orderId");
  const result = cancelOrderFor(id, await getSession());
  if (!result.ok && result.status === 401) {
    redirect(signInUrl("/orders"));
  }
  if (!result.ok && result.status === 404) {
    redirect("/orders");
  }
  redirect(`/checkout?order=${encodeURIComponent(id)}`);
}
