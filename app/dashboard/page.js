import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { isStaffRole } from "@/lib/roles";
import { getAllOrderRows, listAllOrders } from "@/lib/orders";
import { revenueByArea, ordersPerDay, totals } from "@/lib/stats";
import { birr, etb } from "@/lib/format";
import { parseDir, parseSort } from "@/lib/order-table";
import { parsePage as parsePageNumber } from "@/lib/paging";
import { applyDemo, demoMode } from "@/lib/demo";
import Button from "@/components/Button";
import EmptyState from "@/components/EmptyState";
import OrderTable from "@/components/OrderTable";
import RevenueChart from "./RevenueChart";
import OrdersChart from "./OrdersChart";
import "./dashboard.css";

export const metadata = {
  title: "Dashboard",
  description: "Staff view of Addis Eats revenue by neighbourhood, orders per day and every order.",
};

// Dynamic (ƒ): reads the session cookie and the query string, and the numbers change
// with every order. Private and staff only — see AUTH.md.
export const dynamic = "force-dynamic";

// Staff only, checked on the SERVER like /kitchen: the page verifies the session and the
// role, and listAllOrders / getAllOrderRows refuse a non-staff session again. A customer
// gets the same 404 as any unknown URL.
//
// Aggregation happens HERE, on the server: the two charts receive 5 and 30 summarised
// rows, not every order. The order table receives one page of ten.
export default async function DashboardPage({ searchParams }) {
  const session = await requireSession("/dashboard");
  if (!isStaffRole(session.role)) notFound(); // staff, or an admin (who can do everything staff can)

  const demo = demoMode(searchParams);
  await applyDemo(demo); // ?demo=loading waits 3 s, ?demo=error throws → loading.js / error.js

  const sort = parseSort(searchParams.sort);
  const dir = parseDir(searchParams.dir);
  const page = parsePageNumber(searchParams.page);
  const orders = demo === "empty" ? [] : listAllOrders(session) ?? [];

  if (orders.length === 0) {
    return (
      <div className="container section">
        <h1>Dashboard</h1>
        <EmptyState
          icon="📊"
          title="No orders yet"
          message="Revenue and orders-per-day appear here as soon as customers place orders. Nothing is shown until there is something real to show."
          action={
            <Button as={Link} href="/menu" variant="primary">
              Browse the menu
            </Button>
          }
        />
      </div>
    );
  }

  const byArea = revenueByArea(orders);
  const perDay = ordersPerDay(orders);
  const summary = totals(orders);
  const table = getAllOrderRows(session, { sort, dir, page });

  return (
    <div className="container section dashboard">
      <h1>Dashboard</h1>
      <p className="dashboard__lead">
        Cancelled orders are left out of revenue and order counts. Times are Addis Ababa time (EAT, UTC+3).
      </p>

      <dl className="stat-grid">
        <div className="stat">
          <dt>Orders</dt>
          <dd>{summary.orders}</dd>
        </div>
        <div className="stat">
          <dt>Revenue</dt>
          <dd>{etb.format(summary.revenue)}</dd>
        </div>
        <div className="stat">
          <dt>Average order</dt>
          <dd>{etb.format(summary.average)}</dd>
        </div>
      </dl>

      <section className="dashboard__card" aria-labelledby="revenue-heading">
        <h2 id="revenue-heading">Revenue by neighbourhood, all time (ETB)</h2>
        <RevenueChart data={byArea} />
        <div className="table-scroll" role="region" aria-label="Revenue by neighbourhood (scrollable)" tabIndex={0}>
          <table className="data-table">
            <caption>The same numbers: revenue by neighbourhood</caption>
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
              {byArea.map((row) => (
                <tr key={row.area}>
                  <th scope="row">{row.fullName}</th>
                  <td className="num">{row.orders}</td>
                  <td className="num">{birr.format(row.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="dashboard__card" aria-labelledby="daily-heading">
        <h2 id="daily-heading">
          Orders per day, {perDay.from} – {perDay.to} (last {perDay.days} days)
        </h2>
        <OrdersChart data={perDay.rows} />
        <div className="table-scroll table-scroll--tall" role="region" aria-label="Orders per day (scrollable)" tabIndex={0}>
          <table className="data-table">
            <caption>The same numbers: orders per day</caption>
            <thead>
              <tr>
                <th scope="col">Day</th>
                <th scope="col" className="num">
                  Orders
                </th>
              </tr>
            </thead>
            <tbody>
              {perDay.rows.map((row) => (
                <tr key={row.day}>
                  <th scope="row">{row.label}</th>
                  <td className="num">{row.orders}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="dashboard__card" aria-labelledby="orders-heading">
        <h2 id="orders-heading">All orders</h2>
        <OrderTable
          result={table}
          basePath="/dashboard"
          sort={sort}
          dir={dir}
          caption="All orders, newest first by default"
          staff
        />
      </section>
    </div>
  );
}
