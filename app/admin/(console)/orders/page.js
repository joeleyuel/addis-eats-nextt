import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin-auth";
import { queryAdminOrders } from "@/lib/orders";
import { ORDER_STATUSES, STATUS_LABELS } from "@/lib/order-status";
import { DELIVERY_AREAS } from "@/lib/delivery";
import { birr, whenDate, whenTime } from "@/lib/format";
import { defaultDir } from "@/lib/order-table";
import { ORDER_DEFAULTS, listHref, parseOrderFilters } from "@/lib/admin-filters";
import Button from "@/components/Button";
import EmptyState from "@/components/EmptyState";
import PageHeader from "../../_components/PageHeader";
import StatusPill from "../../_components/StatusPill";
import Pagination from "../../_components/Pagination";
import AutoRefresh from "../../_components/AutoRefresh";

export const metadata = { title: "Orders" };
export const dynamic = "force-dynamic";

const COLUMNS = [
  { key: "id", label: "Order" },
  { key: "date", label: "Placed" },
  { key: "customer", label: "Customer", sortable: false },
  { key: "area", label: "Area", sortable: false },
  { key: "status", label: "Status" },
  { key: "total", label: "Total (ETB)", numeric: true },
];

const areaLabel = (id) => DELIVERY_AREAS.find((a) => a.id === id)?.short ?? id;

export default async function AdminOrdersPage({ searchParams }) {
  const session = await requireAdmin("/admin/orders");
  const filters = parseOrderFilters(searchParams);
  const { sort, dir, page, ...criteria } = filters;
  const result = queryAdminOrders(session, criteria, { sort, dir, page });
  if (!result) notFound();

  // Every link keeps the active filters; only what it changes is replaced.
  const hrefWith = (changes) => listHref("/admin/orders", { ...filters, ...changes }, ORDER_DEFAULTS);
  const filtered = Boolean(criteria.q || criteria.status || criteria.area || criteria.from || criteria.to);

  const tabs = [{ key: "", label: "All", count: result.counts.all }, ...ORDER_STATUSES.map((s) => ({ key: s, label: STATUS_LABELS[s], count: result.counts[s] }))];

  return (
    <>
      <PageHeader title="Orders" lead="Search, filter and open an order to see its items and change its status." actions={<AutoRefresh />} />

      <nav className="admin-tabs" aria-label="Filter by status">
        {tabs.map((tab) => (
          <Link
            key={tab.key || "all"}
            href={hrefWith({ status: tab.key, page: 1 })}
            className={`admin-tabs__tab${filters.status === tab.key ? " is-active" : ""}`}
            aria-current={filters.status === tab.key ? "page" : undefined}
            prefetch={false}
          >
            {tab.label} <span className="admin-tabs__count">{tab.count}</span>
          </Link>
        ))}
      </nav>

      {/* A plain GET form: the filters become the URL, so it works without JavaScript. */}
      <form className="admin-filters" method="get" action="/admin/orders" role="search" aria-label="Search orders">
        {filters.status && <input type="hidden" name="status" value={filters.status} />}
        <div className="field">
          <label htmlFor="f-q">Search</label>
          <input id="f-q" name="q" type="search" defaultValue={filters.q} placeholder="Order number, name or phone" maxLength={60} />
        </div>
        <div className="field">
          <label htmlFor="f-area">Area</label>
          <select id="f-area" name="area" defaultValue={filters.area}>
            <option value="">All areas</option>
            {DELIVERY_AREAS.map((area) => (
              <option key={area.id} value={area.id}>
                {area.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="f-from">From</label>
          <input id="f-from" name="from" type="date" defaultValue={filters.from} />
        </div>
        <div className="field">
          <label htmlFor="f-to">To</label>
          <input id="f-to" name="to" type="date" defaultValue={filters.to} />
        </div>
        <div className="admin-filters__buttons">
          <Button type="submit" variant="primary">
            Apply
          </Button>
          {filtered && (
            <Button as={Link} href="/admin/orders" variant="secondary">
              Clear
            </Button>
          )}
        </div>
      </form>

      {result.total === 0 ? (
        filtered ? (
          <EmptyState
            icon="🔎"
            title="No orders match"
            message="Try a different search, widen the dates, or clear the filters."
            action={
              <Button as={Link} href="/admin/orders" variant="secondary">
                Clear filters
              </Button>
            }
          />
        ) : (
          <EmptyState icon="🧾" title="No orders yet" message="Orders appear here as soon as customers place them." />
        )
      ) : (
        <>
          <div className="table-scroll" role="region" aria-label="Orders (scrollable)" tabIndex={0}>
            <table className="data-table">
              <caption className="visually-hidden">Orders, newest first by default</caption>
              <thead>
                <tr>
                  {COLUMNS.map((column) => {
                    if (column.sortable === false) {
                      return (
                        <th key={column.key} scope="col">
                          {column.label}
                        </th>
                      );
                    }
                    const active = sort === column.key;
                    const nextDir = active ? (dir === "asc" ? "desc" : "asc") : defaultDir(column.key);
                    return (
                      <th key={column.key} scope="col" className={column.numeric ? "num" : undefined} aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : undefined}>
                        <Link href={hrefWith({ sort: column.key, dir: nextDir, page: 1 })} className="sort-link" prefetch={false}>
                          {column.label}
                          <span aria-hidden="true" className="sort-link__arrow">
                            {active ? (dir === "asc" ? "▲" : "▼") : "↕"}
                          </span>
                        </Link>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row) => (
                  <tr key={row.id}>
                    <th scope="row" className="data-table__id">
                      <Link href={`/admin/orders/${row.id}`} className="data-table__link">
                        #{row.id}
                      </Link>
                    </th>
                    <td>
                      <time dateTime={new Date(row.createdAt).toISOString()}>
                        {whenDate.format(new Date(row.createdAt))} <span className="data-table__time">{whenTime.format(new Date(row.createdAt))}</span>
                      </time>
                    </td>
                    <td>
                      {row.customer}
                      <span className="admin-sub">{row.phone}</span>
                    </td>
                    <td>{areaLabel(row.area)}</td>
                    <td>
                      <StatusPill status={row.status} />
                    </td>
                    <td className="num">{birr.format(row.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="table-count" role="status">
            Showing page {result.page} of {result.pages} · {result.total} {result.total === 1 ? "order" : "orders"}
          </p>
          <Pagination page={result.page} pages={result.pages} hrefFor={(n) => hrefWith({ page: n })} />
        </>
      )}
    </>
  );
}
