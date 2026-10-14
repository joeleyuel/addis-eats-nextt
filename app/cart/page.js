import CartView from "./CartView";
import "./cart.css";

export const metadata = {
  title: "Your Cart",
  description: "Review the dishes in your cart, change quantities and see the delivery fee before you check out.",
};

// Rendered on the client: the cart is private to this browser tab's storage,
// so the server can only ship a static shell. CartView fills it in.
export default function CartPage() {
  return <CartView />;
}
