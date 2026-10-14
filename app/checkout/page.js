import { cookies } from "next/headers";
import { requireSession } from "@/lib/session";
import { getOrderFor, priceLines } from "@/lib/orders";
import { CART_COOKIE, parseCart } from "@/lib/cart";
import EmptyState from "@/components/EmptyState";
import Confirmation from "./Confirmation";
import CheckoutForm from "./CheckoutForm";
import "./checkout.css";

// /checkout accepts ?order=, so it declares a canonical URL.
export const metadata = {
  title: "Checkout",
  description: "Enter your delivery address and phone number, check your order summary and place your Addis Eats order.",
  alternates: { canonical: "/checkout" },
};

// Dynamic (ƒ/λ): it reads the session cookie and the cart cookie, and a
// per-customer page must never be cached for somebody else. Stated explicitly
// so a refactor cannot silently make it static. Private: see AUTH.md.
export const dynamic = "force-dynamic";

export default async function CheckoutPage({ searchParams }) {
  const orderId = typeof searchParams.order === "string" ? searchParams.order : "";

  // Layer 2: verify the session while rendering (middleware only checked that a
  // cookie exists). A signed-out visitor goes to /signin and comes back here.
  const session = await requireSession(orderId ? `/checkout?order=${encodeURIComponent(orderId)}` : "/checkout");

  if (orderId) {
    // Scoped to the session: someone else's order id finds nothing.
    const order = getOrderFor(orderId, session);
    if (order) return <Confirmation order={order} session={session} />;
    return (
      <div className="container section">
        <h1>Checkout</h1>
        <EmptyState
          icon="🧾"
          title="Order not found"
          message="We couldn't find that order on your account."
        />
      </div>
    );
  }

  const cart = await priceLines(parseCart(cookies().get(CART_COOKIE)?.value));
  // Dishes that left the menu since they were added are not charged for — but the
  // customer is told, rather than the total quietly differing from their cart.
  const unavailable = cart.unknown.length;
  if (cart.lines.length === 0) {
    return (
      <div className="container section">
        <h1>Checkout</h1>
        <EmptyState
          icon="🧾"
          title="Nothing to check out yet"
          message="Add a dish or two from the menu before heading to checkout."
        />
      </div>
    );
  }

  return (
    <CheckoutForm
      lines={cart.lines.map(({ id, name, price, quantity }) => ({ id, name, price, quantity }))}
      subtotal={cart.subtotal}
      defaults={{ name: session.name, phone: session.phone }}
      unavailable={unavailable}
    />
  );
}
