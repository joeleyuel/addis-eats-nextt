import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { isStaffRole } from "@/lib/roles";
import { getStatus, listAllOrders } from "@/lib/orders";
import { formatETB } from "@/lib/format";
import { DELIVERY_AREAS } from "@/lib/delivery";
import { signOut } from "@/app/actions";
import EmptyState from "@/components/EmptyState";
import "../checkout/checkout.css";
import "../orders/orders.css";

export const metadata = {
  title: "Kitchen",
  description: "Staff view of incoming Addis Eats orders and their preparation status.",
};

// Dynamic (ƒ): it reads the session cookie.
export const dynamic = "force-dynamic";

// Staff only, and checked on the SERVER — not by hiding a link. Three layers:
//   middleware   → a session cookie exists
//   this page    → the session is genuine (requireSession) AND role === "staff"
//   lib/orders   → listAllOrders refuses a non-staff session again
// A customer gets the same 404 as any unknown URL, so the route's existence is not
// confirmed to them either.
export default async function KitchenPage() {
  const session = await requireSession("/kitchen");
  if (!isStaffRole(session.role)) notFound(); // staff, or an admin (who can do everything staff can)

  const orders = listAllOrders(session) ?? [];

  return (
    <div className="container section checkout-page">
      <h1>Kitchen</h1>
      {orders.length === 0 ? (
        <EmptyState icon="🍳" title="No orders yet" message="New orders appear here as customers place them." />
      ) : (
        <ul className="order-list">
          {orders.map((order) => (
            <li key={order.id} className="order-list__row order-list__row--static">
              <span>
                <strong>#{order.id}</strong> · {order.customer.name.split(" ")[0]} ·{" "}
                {DELIVERY_AREAS.find((a) => a.id === order.area)?.label ?? order.area}
                <br />
                <small>{order.items.map((item) => `${item.quantity}× ${item.name}`).join(", ")}</small>
              </span>
              <span>{getStatus(order).replace("_", " ")}</span>
              <span>{formatETB(order.total)}</span>
            </li>
          ))}
        </ul>
      )}

      <form action={signOut} className="checkout-confirm__signout">
        <span>Signed in as {session.name}. </span>
        <button type="submit" className="signout-btn">
          Sign out
        </button>
      </form>
    </div>
  );
}
