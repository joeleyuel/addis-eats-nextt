"use client";
// Client because context needs state. It receives everything below it as
// `children`, so server-rendered pages pass through it without becoming client code.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { CART_COOKIE, CART_COOKIE_PATH, serializeCart } from "@/lib/cart";
import { MAX_QUANTITY } from "@/lib/validate";

const CartContext = createContext(null);
const STORAGE_KEY = "addis-eats:cart";

function isValidLine(item) {
  return (
    item &&
    typeof item.id === "string" &&
    typeof item.name === "string" &&
    Number.isFinite(item.price) &&
    Number.isInteger(item.quantity) &&
    item.quantity >= 1
  );
}

// Corrupted or outdated saved data must never crash the app — drop bad lines.
function readSavedCart() {
  try {
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(stored)
      ? stored.filter(isValidLine).map((item) => ({ ...item, quantity: Math.min(MAX_QUANTITY, item.quantity) }))
      : [];
  } catch {
    return [];
  }
}

function writeSavedCart(items) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Storage blocked or full — the cart keeps working in memory.
  }
}

// Mirror { id, quantity } into a cookie that is only sent to /checkout.
function writeCartCookie(items) {
  const value = encodeURIComponent(serializeCart(items));
  document.cookie = `${CART_COOKIE}=${value}; Path=${CART_COOKIE_PATH}; Max-Age=${60 * 60 * 24 * 7}; SameSite=Lax`;
}

function CartProvider({ children }) {
  const [items, setItems] = useState([]);
  // The server renders without a cart; `ready` flips once localStorage is read,
  // so pages never flash "empty" and never overwrite the saved cart with [].
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setItems(readSavedCart());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    writeSavedCart(items);
    writeCartCookie(items);
  }, [items, ready]);

  const addItem = useCallback((dish, quantity = 1) => {
    setItems((prev) => {
      const existing = prev.find((item) => item.id === dish.id);
      if (existing) {
        // Capped at the most an order may hold (MAX_QUANTITY): the server refuses more,
        // and a cart that can grow past it would only fail at checkout.
        return prev.map((item) =>
          item.id === dish.id ? { ...item, quantity: Math.min(MAX_QUANTITY, item.quantity + quantity) } : item
        );
      }
      return [
        ...prev,
        {
          id: dish.id,
          name: dish.name,
          price: dish.price,
          image: dish.image,
          category: dish.category,
          quantity: Math.min(MAX_QUANTITY, quantity),
        },
      ];
    });
  }, []);

  const removeItem = useCallback((id) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const updateQuantity = useCallback(
    (id, quantity) => {
      if (quantity < 1) {
        removeItem(id);
        return;
      }
      const capped = Math.min(MAX_QUANTITY, quantity);
      setItems((prev) => prev.map((item) => (item.id === id ? { ...item, quantity: capped } : item)));
    },
    [removeItem]
  );

  const clearCart = useCallback(() => setItems([]), []);

  const subtotal = useMemo(() => items.reduce((sum, item) => sum + item.price * item.quantity, 0), [items]);
  const itemCount = useMemo(() => items.reduce((sum, item) => sum + item.quantity, 0), [items]);

  const value = useMemo(
    () => ({ items, ready, addItem, updateQuantity, removeItem, clearCart, subtotal, itemCount }),
    [items, ready, addItem, updateQuantity, removeItem, clearCart, subtotal, itemCount]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within Providers");
  return ctx;
}

export default function Providers({ children }) {
  return <CartProvider>{children}</CartProvider>;
}
