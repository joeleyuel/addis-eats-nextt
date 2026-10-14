"use client";
// Client leaf. The status polling that lived here on Day 40 (setInterval, abort
// controller, cleanup, status state) is now useSWR inside OrderStatus. What stays
// here is the one thing SWR does not do: emptying the browser's cart (localStorage)
// now that the order exists.
import { useEffect } from "react";
import { useCart } from "@/components/Providers";
import OrderStatus from "@/app/orders/OrderStatus";

export default function OrderTracker({ orderId, initialStatus }) {
  const { clearCart, ready } = useCart();

  // Wait for the store to finish loading localStorage, or it would restore the cart.
  useEffect(() => {
    if (ready) clearCart();
  }, [ready, clearCart]);

  return <OrderStatus id={orderId} initial={{ id: orderId, status: initialStatus }} />;
}
