import Link from "next/link";
import { requireSession } from "@/lib/session";
import { getOrderRowsFor } from "@/lib/orders";
import { parseDir, parseSort } from "@/lib/order-table";
import { parsePage } from "@/lib/paging";
import { applyDemo, demoMode } from "@/lib/demo";
import { signOut } from "@/app/actions";
import Button from "@/components/Button";
import EmptyState from "@/components/EmptyState";
import OrderTable from "@/components/OrderTable";
import "../checkout/checkout.css";
import "./orders.css";

export const metadata = {
  title: "My orders",
  description: "See your Addis Eats orders, their delivery status and totals in one place.",
};

// Dynamic (ƒ): it reads the session cookie and the query string, and the list belongs to
// one customer.
export const dynamic = "force-dynamic";

// Layer 2: the session is verified while rendering. The query takes the SESSION
// (getOrderRowsFor filters on session.uid) — ?sort, ?dir and ?page only change the order
// and window of the customer's OWN list. There is no id in the URL to change, so another
// customer's orders cannot be asked for.
//
// Four states (Day 46): loading → loading.js · empty → below · error → error.js ·
// loaded → the table. Force any of them with ?demo=loading | empty | error.
export default async function OrdersPage({ searchParams }) {
  const session = await requireSession("/orders");
  const demo = demoMode(searchParams);
  await applyDemo(demo);

  const sort = parseSort(searchParams.sort);
  const dir = parseDir(searchParams.dir);
  const result = demo === "empty" ? null : getOrderRowsFor(session, { sort, dir, page: parsePage(searchParams.page) });
  const isEmpty = !result || result.total === 0;

  return (
    <div className="container section orders-page">
      <div className="orders-page__head">
        <div>
          <h1>My orders</h1>
          {!isEmpty && (
            <p>
              {result.total} {result.total === 1 ? "order" : "orders"} on this account. Select an order to follow its delivery.
            </p>
          )}
        </div>
        {!isEmpty && (
          <Button as="a" href="/api/orders/export" download="addis-eats-orders.csv" variant="secondary">
            ⬇ Download CSV
          </Button>
        )}
      </div>

      {isEmpty ? (
        <EmptyState
          icon="🧾"
          title="No orders yet"
          message="Browse the menu to place your first order — it will show up here, with its status and total."
          action={
            <Button as={Link} href="/menu" variant="primary">
              Browse the menu
            </Button>
          }
        />
      ) : (
        <OrderTable
          result={result}
          basePath="/orders"
          sort={sort}
          dir={dir}
          caption="Your orders, most recent first by default"
        />
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
