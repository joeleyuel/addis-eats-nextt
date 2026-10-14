"use client";
// Client because the whole screen is the browser's cart store.
import { useState } from "react";
import Link from "next/link";
import { useCart } from "@/components/Providers";
import Button from "@/components/Button";
import EmptyState from "@/components/EmptyState";
import FoodImage from "@/components/FoodImage";
import QuantityStepper from "@/components/QuantityStepper";
import { DELIVERY_AREAS } from "@/lib/delivery";
import { MAX_QUANTITY } from "@/lib/validate";
import { etb } from "@/lib/format";

// Real numbers from the delivery table, not a guess: "ETB 70 – ETB 110".
const FEES = DELIVERY_AREAS.map((area) => area.fee);
const FEE_RANGE = `${etb.format(Math.min(...FEES))} – ${etb.format(Math.max(...FEES))}`;

function CartSkeleton() {
  return (
    <div className="container section cart-page" aria-busy="true">
      <h1>Your cart</h1>
      <p className="visually-hidden" role="status">
        Loading your cart…
      </p>
      <div className="cart-page__grid" aria-hidden="true">
        <div className="cart-list">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton cart-skeleton" />
          ))}
        </div>
        <div className="skeleton cart-skeleton cart-skeleton--summary" />
      </div>
    </div>
  );
}

export default function CartView() {
  const { items, ready, itemCount, updateQuantity, removeItem, subtotal, clearCart } = useCart();
  const [confirmingClear, setConfirmingClear] = useState(false);

  // The saved cart is read after hydration; until then show the SHAPE of the page
  // rather than a flash of "empty".
  if (!ready) return <CartSkeleton />;

  if (items.length === 0) {
    return (
      <div className="container section">
        <h1>Your cart</h1>
        <EmptyState
          icon="🛒"
          title="Your cart is empty"
          message="Browse the menu and add a few Ethiopian favorites to get started."
          action={
            <Button as={Link} href="/menu" variant="primary">
              Browse dishes
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="container section cart-page">
      <div className="cart-page__header">
        <div>
          <h1>Your cart</h1>
          <p>
            {itemCount} {itemCount === 1 ? "item" : "items"} · {items.length} {items.length === 1 ? "dish" : "dishes"}
          </p>
        </div>
        {confirmingClear ? (
          <div className="cart-page__confirm" role="group" aria-label="Confirm clearing the cart">
            <span>Remove everything?</span>
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                clearCart();
                setConfirmingClear(false);
              }}
            >
              Yes, clear it
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setConfirmingClear(false)}>
              Keep my cart
            </Button>
          </div>
        ) : (
          <button type="button" className="link-btn" onClick={() => setConfirmingClear(true)}>
            Clear cart
          </button>
        )}
      </div>

      <div className="cart-page__grid">
        <ul className="cart-list" aria-label="Dishes in your cart">
          {items.map((item) => (
            <li key={item.id} className="cart-line">
              {/* Decorative: the dish name sits right beside it, so alt is empty. */}
              <FoodImage src={item.image} alt="" width={96} height={96} sizes="96px" className="cart-line__img" />
              <div className="cart-line__info">
                <h2 className="cart-line__name">{item.name}</h2>
                <p className="cart-line__unit">{etb.format(item.price)} each</p>
                <button
                  type="button"
                  className="link-btn"
                  onClick={() => removeItem(item.id)}
                  aria-label={`Remove ${item.name} from cart`}
                >
                  Remove
                </button>
              </div>
              <div className="cart-line__qty">
                <QuantityStepper
                  name={item.name}
                  quantity={item.quantity}
                  max={MAX_QUANTITY}
                  onChange={(next) => updateQuantity(item.id, next)}
                />
              </div>
              <p className="cart-line__total">{etb.format(item.price * item.quantity)}</p>
            </li>
          ))}
        </ul>

        <aside className="cart-summary" aria-labelledby="summary-heading">
          <h2 id="summary-heading">Order summary</h2>
          <div className="cart-summary__row">
            <span>Delivery</span>
            <span>{FEE_RANGE}</span>
          </div>
          <p className="cart-summary__note">The exact fee and delivery time depend on your area. You choose it at checkout.</p>
          <div className="cart-summary__row cart-summary__row--total">
            <span>Subtotal</span>
            <span>{etb.format(subtotal)}</span>
          </div>
          <Button as={Link} href="/checkout" variant="primary" size="lg" className="btn--full cart-summary__cta">
            Proceed to checkout →
          </Button>
          <Link href="/menu" className="cart-summary__continue">
            ← Continue browsing dishes
          </Link>
        </aside>
      </div>

      {/* Phones: the checkout action stays in reach however long the cart is. */}
      <div className="cart-bar">
        <div>
          <span className="cart-bar__label">Subtotal</span>
          <strong>{etb.format(subtotal)}</strong>
        </div>
        <Button as={Link} href="/checkout" variant="primary" size="md">
          Checkout →
        </Button>
      </div>
    </div>
  );
}
