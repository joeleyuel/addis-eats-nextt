import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin-auth";
import { adminOverview } from "@/lib/orders";
import { getDishes } from "@/lib/dishes";
import { ORDER_STATUSES, STATUS_LABELS } from "@/lib/order-status";
import { birr, etb, relative, formatWhen } from "@/lib/format";
import Button from "@/components/Button";
import EmptyState from "@/components/EmptyState";
import RevenueChart from "@/app/dashboard/RevenueChart";
import OrdersChart from "@/app/dashboard/OrdersChart";
import PageHeader from "../_components/PageHeader";
import StatusPill from "../_components/StatusPill";
import AutoRefresh from "../_components/AutoRefresh";

export const metadata = { title: "Overview" };

// Dynamic (ƒ): the session cookie and the live order list.
export const dynamic = "force-dynamic";

// Every number here comes from adminOverview(), which reads the orders that exist right now
// (cancelled orders are left out of revenue and order counts), and from the real menu file.
// Nothing is a sample. With no orders the cards honestly say 0.
export default async function AdminOverviewPage() {
  const session = await requireAdmin("/admin");
  const overview = adminOverview(session);
  if (!overview) notFound();
  const dishes = await getDishes();
  const { totals, today, statusCounts } = overview;
  const statusTotal = overview.orderCount;

  return (
    <>
      <PageHeader
        title="Overview"
        lead="Cancelled orders are left out of revenue and order counts. Times are Addis Ababa time (EAT, UTC+3)."
        actions={<AutoRefresh />}
      />

      <dl className="admin-stats">
        <div className="stat">
          <dt>Orders</dt>
          <dd>{totals.orders}</dd>
          <dd className="stat__hint">{today.orders} today</dd>
        </div>
        <div className="stat">
          <dt>Revenue</dt>
          <dd>{etb.format(totals.revenue)}</dd>
          <dd className="stat__hint">{etb.format(today.revenue)} today</dd>
        </div>
        <div className="stat">
          <dt>Average order</dt>
          <dd>{etb.format(totals.average)}</dd>
          <dd className="stat__hint">{totals.cancelled} cancelled</dd>
        </div>
        <div className="stat">
          <dt>Active orders</dt>
          <dd>{overview.activeOrders}</dd>
          <dd className="stat__hint">received or preparing</dd>
        </div>
        <div className="stat">
          <dt>Customers</dt>
          <dd>{overview.customers}</dd>
          <dd className="stat__hint">have ordered</dd>
        </div>
        <div className="stat">
          <dt>Dishes on the menu</dt>
          <dd>{dishes.length}</dd>
          <dd className="stat__hint">
            <Link href="/admin/dishes" className="admin-link">
              Manage dishes
            </Link>
          </dd>
        </div>
      </dl>

      {overview.orderCount === 0 ? (
        <EmptyState
          icon="📊"
          title="No orders yet"
          message="Charts, the latest orders and recent activity appear here as soon as customers place orders. Nothing is shown until there is something real to show."
          action={
            <Button as={Link} href="/menu" variant="primary">
              Browse the menu
            </Button>
          }
        />
      ) : (
        <>
          <section className="dashboard__card" aria-labelledby="latest-heading">
            <div className="admin-card__head">
              <h2 id="latest-heading">Latest orders</h2>
              <Link href="/admin/orders" className="admin-link">
                All orders
              </Link>
            </div>
            <div className="table-scroll" role="region" aria-label="Latest orders (scrollable)" tabIndex={0}>
              <table className="data-table">
                <caption className="visually-hidden">The five most recent orders</caption>
                <thead>
                  <tr>
                    <th scope="col">Order</th>
                    <th scope="col">Placed</th>
                    <th scope="col">Customer</th>
                    <th scope="col">Status</th>
                    <th scope="col" className="num">
                      Total (ETB)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {overview.latest.map((row) => (
                    <tr key={row.id}>
                      <th scope="row" className="data-table__id">
                        <Link href={`/admin/orders/${row.id}`} className="data-table__link">
                          #{row.id}
                        </Link>
                      </th>
                      <td>{relative(row.createdAt)}</td>
                      <td>{row.customer}</td>
                      <td>
                        <StatusPill status={row.status} />
                      </td>
                      <td className="num">{birr.format(row.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <div className="admin-two-col">
            <section className="dashboard__card" aria-labelledby="status-heading">
              <h2 id="status-heading">Orders by status</h2>
              <ul className="status-bars">
                {ORDER_STATUSES.map((status) => (
                  <li key={status}>
                    <Link href={`/admin/orders?status=${status}`} className="status-bars__row">
                      <span className="status-bars__label">{STATUS_LABELS[status]}</span>
                      <span className="status-bars__track" aria-hidden="true">
                        <span className={`status-bars__fill status-bars__fill--${status}`} style={{ width: `${statusTotal ? (statusCounts[status] / statusTotal) * 100 : 0}%` }} />
                      </span>
                      <span className="status-bars__count">{statusCounts[status]}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>

            <section className="dashboard__card" aria-labelledby="activity-heading">
              <h2 id="activity-heading">Recent activity</h2>
              <ol className="activity">
                {overview.activity.map((event) => (
                  <li key={`${event.type}-${event.orderId}-${event.at}`}>
                    <span>
                      {event.type === "placed" ? (
                        <>
                          <strong>{event.actor}</strong> placed{" "}
                        </>
                      ) : (
                        <>
                          <strong>{event.actor}</strong> set{" "}
                        </>
                      )}
                      <Link href={`/admin/orders/${event.orderId}`} className="admin-link">
                        #{event.orderId}
                      </Link>
                      {event.type === "status" && <> to {STATUS_LABELS[event.status]}</>}
                    </span>
                    <time dateTime={new Date(event.at).toISOString()} title={formatWhen(event.at)}>
                      {relative(event.at)}
                    </time>
                  </li>
                ))}
              </ol>
            </section>
          </div>

          <section className="dashboard__card" aria-labelledby="revenue-heading">
            <h2 id="revenue-heading">Revenue by neighbourhood, all time (ETB)</h2>
            <RevenueChart data={overview.byArea} />
            <details className="admin-details">
              <summary>Show the numbers as a table</summary>
              <div className="table-scroll" role="region" aria-label="Revenue by neighbourhood (scrollable)" tabIndex={0}>
                <table className="data-table">
                  <caption className="visually-hidden">Revenue by neighbourhood</caption>
                  <thead>
                    <tr>
                      <th scope="col">Neighbourhood</th>
                      <th scope="col" className="num">
                        Orders
                      </th>
                      <th scope="col" className="num">
                        Revenue (ETB)
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {overview.byArea.map((row) => (
                      <tr key={row.area}>
                        <th scope="row">{row.fullName}</th>
                        <td className="num">{row.orders}</td>
                        <td className="num">{birr.format(row.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </section>

          <section className="dashboard__card" aria-labelledby="daily-heading">
            <h2 id="daily-heading">
              Orders per day, {overview.perDay.from} – {overview.perDay.to} (last {overview.perDay.days} days)
            </h2>
            <OrdersChart data={overview.perDay.rows} />
            <details className="admin-details">
              <summary>Show the numbers as a table</summary>
              <div className="table-scroll table-scroll--tall" role="region" aria-label="Orders per day (scrollable)" tabIndex={0}>
                <table className="data-table">
                  <caption className="visually-hidden">Orders per day</caption>
                  <thead>
                    <tr>
                      <th scope="col">Day</th>
                      <th scope="col" className="num">
                        Orders
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {overview.perDay.rows.map((row) => (
                      <tr key={row.day}>
                        <th scope="row">{row.label}</th>
                        <td className="num">{row.orders}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </section>

          <section className="dashboard__card" aria-labelledby="top-heading">
            <h2 id="top-heading">Best-selling dishes</h2>
            <div className="table-scroll" role="region" aria-label="Best-selling dishes (scrollable)" tabIndex={0}>
              <table className="data-table">
                <caption className="visually-hidden">Dishes ordered most, from orders that were not cancelled</caption>
                <thead>
                  <tr>
                    <th scope="col">Dish</th>
                    <th scope="col" className="num">
                      Sold
                    </th>
                    <th scope="col" className="num">
                      Revenue (ETB)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {overview.topDishes.map((dish) => (
                    <tr key={dish.id}>
                      <th scope="row">{dish.name}</th>
                      <td className="num">{dish.quantity}</td>
                      <td className="num">{birr.format(dish.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {overview.topDishes.length === 0 && <p className="table-count">Every order so far was cancelled, so no dish has sold yet.</p>}
          </section>
        </>
      )}
      <p className="admin-footnote">Orders are held in memory and start again from zero when the server restarts.</p>
    </>
  );
}
