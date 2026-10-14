import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { getOrderFor, getTracking } from "@/lib/orders";
import { getDeliveryArea, getEstimatedDeliveryTime } from "@/lib/delivery";
import { etb, relative, when } from "@/lib/format";
import Button from "@/components/Button";
import LiveTracking from "./LiveTracking";
import "../../checkout/checkout.css";
import "../orders.css";

export const metadata = {
  title: "Order status",
  description: "Follow this order from the kitchen to your door and see what you ordered.",
};

// Dynamic (ƒ): it reads the session cookie, and an order belongs to one customer.
export const dynamic = "force-dynamic";

// Server component: authorises, loads the order and renders the page complete. Only the
// live tracking (EventSource + map) is client code, and it is seeded from this render.
export default async function OrderPage({ params }) {
  // Layer 2: verify the session while rendering; signed-out → /signin and back here.
  const session = await requireSession(`/orders/${encodeURIComponent(params.id)}`);

  // Scoped to the session: someone else's order and a missing order both end here.
  const order = getOrderFor(params.id, session);
  if (!order) notFound();

  const tracking = getTracking(order);
  const area = getDeliveryArea(order.area);
  const placed = new Date(order.createdAt);

  return (
    <div className="container section order-detail">
      <h1>Order #{order.id}</h1>
      <p className="order-detail__meta">
        Placed <time dateTime={placed.toISOString()}>{when.format(placed)}</time> ({relative(order.createdAt)})
      </p>

      <div className="order-detail__grid">
        <section className="order-card" aria-labelledby="track-heading">
          <h2 id="track-heading">Track your delivery</h2>
          <LiveTracking
            id={order.id}
            initial={tracking}
            area={{ label: area?.label ?? order.area, center: area?.center }}
            address={order.address}
            eta={getEstimatedDeliveryTime(order.area)}
          />
        </section>

        <section className="order-card" aria-labelledby="items-heading">
          <h2 id="items-heading">What you ordered</h2>
          <ul className="checkout-summary__list">
            {order.items.map((item) => (
              <li key={item.id}>
                <span>
                  {item.quantity}× {item.name}
                </span>
                <span>{etb.format(item.price * item.quantity)}</span>
              </li>
            ))}
          </ul>
          <div className="checkout-summary__row">
            <span>Dishes subtotal</span>
            <span>{etb.format(order.subtotal)}</span>
          </div>
          <div className="checkout-summary__row">
            <span>Delivery fee</span>
            <span>{etb.format(order.deliveryFee)}</span>
          </div>
          <div className="checkout-summary__row checkout-summary__row--total">
            <span>Total</span>
            <span>{etb.format(order.total)}</span>
          </div>
          {order.instructions && (
            <p className="map-note">
              <strong>Your note:</strong> {order.instructions}
            </p>
          )}
          <div className="checkout-confirm__actions order-detail__actions">
            <Button as={Link} href="/orders" variant="secondary">
              All my orders
            </Button>
            <Button as={Link} href="/menu" variant="primary">
              Keep browsing
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
