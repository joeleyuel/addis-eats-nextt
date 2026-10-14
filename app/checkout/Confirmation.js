// Server component: the confirmation is plain markup. Only the live status text
// (polled with SWR) and the "clear the browser cart" step are client code. It is only
// ever rendered for an order that EXISTS and belongs to this session — never for a
// failed or pending one.
import Link from "next/link";
import { cancelOrder, signOut } from "@/app/actions";
import { getStatus } from "@/lib/orders";
import { DELIVERY_AREAS, getEstimatedDeliveryTime } from "@/lib/delivery";
import { etb, when } from "@/lib/format";
import Button from "@/components/Button";
import OrderTracker from "./OrderTracker";

export default function Confirmation({ order, session }) {
  const area = DELIVERY_AREAS.find((a) => a.id === order.area);
  const status = getStatus(order);
  const firstName = order.customer.name.split(" ")[0];

  return (
    <div className="container section checkout-page">
      <div className="checkout-confirm">
        <div className="checkout-confirm__icon" aria-hidden="true">
          🎉
        </div>
        <h1>Order confirmed!</h1>
        <p className="checkout-confirm__lead">
          Thanks, {firstName}! Order <strong>#{order.id}</strong> was placed {when.format(new Date(order.createdAt))}. We&apos;ll
          deliver to {area?.label} in about {getEstimatedDeliveryTime(order.area)}.
        </p>

        <OrderTracker key={status} orderId={order.id} initialStatus={status} />

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
          <span>Delivery fee</span>
          <span>{etb.format(order.deliveryFee)}</span>
        </div>
        <div className="checkout-summary__row checkout-summary__row--total">
          <span>Total</span>
          <span>{etb.format(order.total)}</span>
        </div>

        <div className="checkout-confirm__actions">
          <Button as={Link} href={`/orders/${order.id}`} variant="primary">
            Track this order
          </Button>
          <Button as={Link} href="/orders" variant="secondary">
            All my orders
          </Button>
          <Button as={Link} href="/menu" variant="secondary">
            Keep browsing
          </Button>
          {/* Only a convenience: /kitchen refuses non-staff on the server, link or no link. */}
          {session.role === "staff" && (
            <Button as={Link} href="/kitchen" variant="secondary">
              Kitchen
            </Button>
          )}
          {status !== "cancelled" && status !== "on_the_way" && (
            <form action={cancelOrder}>
              <input type="hidden" name="orderId" value={order.id} />
              <Button type="submit" variant="secondary">
                Cancel order
              </Button>
            </form>
          )}
        </div>

        <form action={signOut} className="checkout-confirm__signout">
          <span>Signed in as {session.name}. </span>
          <button type="submit" className="signout-btn">
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
