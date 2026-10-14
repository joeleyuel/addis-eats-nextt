"use client";
// Client leaf: onClick writes to the cart store. Receives only the few
// serialisable fields it needs — never the whole dish, never a function.
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Button from "./Button";
import { useCart } from "./Providers";
import { formatETB } from "@/lib/format";

export default function AddToCartButton({ dish, withQuantity = false }) {
  const { addItem } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [justAdded, setJustAdded] = useState(false);
  const timer = useRef(null);

  // Don't leave a timer running after the customer leaves the page.
  useEffect(() => () => clearTimeout(timer.current), []);

  function handleAdd() {
    addItem(dish, withQuantity ? quantity : 1);
    setJustAdded(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setJustAdded(false), 1800);
  }

  if (!withQuantity) {
    return (
      <Button variant="primary" size="sm" onClick={handleAdd} aria-label={`Add ${dish.name} to cart`}>
        + Add to Cart
      </Button>
    );
  }

  return (
    <>
      <div className="dish-detail__qty">
        <span>Quantity</span>
        <div className="qty-control">
          <button type="button" onClick={() => setQuantity((q) => Math.max(1, q - 1))} aria-label="Decrease quantity">
            −
          </button>
          <span aria-live="polite">{quantity}</span>
          <button type="button" onClick={() => setQuantity((q) => Math.min(50, q + 1))} aria-label="Increase quantity">
            +
          </button>
        </div>
      </div>
      <Button variant="primary" size="lg" className="btn--full" onClick={handleAdd}>
        🛒 Add to Cart · {formatETB(dish.price * quantity)}
      </Button>
      {justAdded && (
        <p className="dish-detail__added" role="status">
          Added to your cart. <Link href="/cart">View cart →</Link>
        </p>
      )}
    </>
  );
}
