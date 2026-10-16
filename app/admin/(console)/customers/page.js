import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin-auth";
import { queryAdminCustomers } from "@/lib/orders";
import { birr, whenDate } from "@/lib/format";
import { CUSTOMER_DEFAULTS, listHref, parseCustomerParams } from "@/lib/admin-filters";
import Button from "@/components/Button";
import EmptyState from "@/components/EmptyState";
import PageHeader from "../../_components/PageHeader";
import Pagination from "../../_components/Pagination";

export const metadata = { title: "Customers" };
export const dynamic = "force-dynamic";

const COLUMNS = [
  { key: "name", label: "Customer", defaultDir: "asc" },
  { key: null, label: "Phone" },
  { key: "orders", label: "Orders", numeric: true, defaultDir: "desc" },
  { key: null, label: "Cancelled", numeric: true },
  { key: "spent", label: "Spent (ETB)", numeric: true, defaultDir: "desc" },
  { key: "last", label: "Last order", defaultDir: "desc" },
];

// Customers are people who have placed an order. The app keeps no separate list of accounts, so
// someone who signed in but never ordered is not here. Phone numbers are masked in this list.
export default async function AdminCustomersPage({ searchParams }) {
  const session = await requireAdmin("/admin/customers");
  const params = parseCustomerParams(searchParams);
  const result = queryAdminCustomers(session, params);
  if (!result) notFound();

  const hrefWith = (changes) => listHref("/admin/customers", { ...params, ...changes }, CUSTOMER_DEFAULTS);
  const filtered = Boolean(params.q);

  return (
    <>
      <PageHeader
        title="Customers"
        lead="People who have placed an order. Phone numbers are partly hidden here; the full number and address are on each order's page, for delivery."
      />

      <form className="admin-filters" method="get" action="/admin/customers" role="search" aria-label="Search customers">
        <div className="field">
          <label htmlFor="c-q">Search</label>
          <input id="c-q" name="q" type="search" defaultValue={params.q} placeholder="Name or phone number" maxLength={60} />
        </div>
        <div className="admin-filters__buttons">
          <Button type="submit" variant="primary">
            Apply
          </Button>
          {filtered && (
            <Button as={Link} href="/admin/customers" variant="secondary">
              Clear
            </Button>
          )}
        </div>
      </form>

      {result.total === 0 ? (
        filtered ? (
          <EmptyState icon="🔎" title="No customers match" message="Try a different name or number." />
        ) : (
          <EmptyState icon="👥" title="No customers yet" message="A customer appears here after their first order." />
        )
      ) : (
        <>
          <div className="table-scroll" role="region" aria-label="Customers (scrollable)" tabIndex={0}>
            <table className="data-table">
              <caption className="visually-hidden">Customers who have ordered</caption>
              <thead>
                <tr>
                  {COLUMNS.map((column) => {
                    if (!column.key) {
                      return (
                        <th key={column.label} scope="col" className={column.numeric ? "num" : undefined}>
                          {column.label}
                        </th>
                      );
                    }
                    const active = params.sort === column.key;
                    const nextDir = active ? (params.dir === "asc" ? "desc" : "asc") : column.defaultDir;
                    return (
                      <th key={column.key} scope="col" className={column.numeric ? "num" : undefined} aria-sort={active ? (params.dir === "asc" ? "ascending" : "descending") : undefined}>
                        <Link href={hrefWith({ sort: column.key, dir: nextDir, page: 1 })} className="sort-link" prefetch={false}>
                          {column.label}
                          <span aria-hidden="true" className="sort-link__arrow">
                            {active ? (params.dir === "asc" ? "▲" : "▼") : "↕"}
                          </span>
                        </Link>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {result.rows.map((customer, index) => (
                  <tr key={`${customer.name}-${customer.phone}-${index}`}>
                    <th scope="row">{customer.name}</th>
                    <td>{customer.phone}</td>
                    <td className="num">{customer.orders}</td>
                    <td className="num">{customer.cancelled}</td>
                    <td className="num">{birr.format(customer.spent)}</td>
                    <td>{whenDate.format(new Date(customer.lastOrderAt))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="table-count" role="status">
            Showing page {result.page} of {result.pages} · {result.total} {result.total === 1 ? "customer" : "customers"}
          </p>
          <Pagination page={result.page} pages={result.pages} hrefFor={(n) => hrefWith({ page: n })} />
        </>
      )}
    </>
  );
}
