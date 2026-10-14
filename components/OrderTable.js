// Server component (Day 46): a read-only table has no state and no handlers, so it
// ships nothing to the browser. Real table markup — caption, thead, th scope — so it is
// accessible, copyable into a spreadsheet and printable. Sorting and paging are plain
// links to real URLs: back button, middle-click and "send someone page three sorted by
// total" all work.
import Link from "next/link";
import { DELIVERY_AREAS } from "@/lib/delivery";
import { birr, whenDate, whenTime } from "@/lib/format";
import { defaultDir, pageWindow, tableHref } from "@/lib/order-table";
import "./DataTable.css";

export const STATUS_TEXT = {
  received: "Received",
  preparing: "Preparing",
  on_the_way: "On the way",
  cancelled: "Cancelled",
};

const COLUMNS = [
  { key: "id", label: "Order" },
  { key: "date", label: "Placed" },
  { key: "status", label: "Status" },
  { key: "total", label: "Total (ETB)", numeric: true },
];

function SortHeader({ column, basePath, sort, dir }) {
  const active = sort === column.key;
  // Clicking the active column flips it; clicking another starts at its natural order.
  const nextDir = active ? (dir === "asc" ? "desc" : "asc") : defaultDir(column.key);
  return (
    <th
      scope="col"
      className={column.numeric ? "num" : undefined}
      aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : undefined}
    >
      <Link href={tableHref(basePath, { sort: column.key, dir: nextDir })} className="sort-link" prefetch={false}>
        {column.label}
        <span aria-hidden="true" className="sort-link__arrow">
          {active ? (dir === "asc" ? "▲" : "▼") : "↕"}
        </span>
      </Link>
    </th>
  );
}

function Pager({ basePath, sort, dir, page, pages }) {
  if (pages <= 1) return null;
  const href = (n) => tableHref(basePath, { sort, dir, page: n });
  return (
    <nav className="table-pager" aria-label="Pagination">
      {page > 1 ? (
        <Link href={href(page - 1)} className="table-pager__link" rel="prev" prefetch={false}>
          ← Previous
        </Link>
      ) : (
        <span className="table-pager__link table-pager__link--off" aria-disabled="true">
          ← Previous
        </span>
      )}
      <ol className="table-pager__pages">
        {pageWindow(page, pages).map((n, i) =>
          n === "…" ? (
            <li key={`gap-${i}`} aria-hidden="true" className="table-pager__gap">
              …
            </li>
          ) : (
            <li key={n}>
              <Link
                href={href(n)}
                className={`table-pager__link table-pager__link--num${n === page ? " is-current" : ""}`}
                aria-current={n === page ? "page" : undefined}
                aria-label={`Page ${n}`}
                prefetch={false}
              >
                {n}
              </Link>
            </li>
          )
        )}
      </ol>
      {page < pages ? (
        <Link href={href(page + 1)} className="table-pager__link" rel="next" prefetch={false}>
          Next →
        </Link>
      ) : (
        <span className="table-pager__link table-pager__link--off" aria-disabled="true">
          Next →
        </span>
      )}
    </nav>
  );
}

// result = { rows, total, page, pages } from paginate(). `staff` adds Customer and Area
// columns (six in all — the most this table should have) and stops linking rows, because
// an order page is scoped to its owner.
export default function OrderTable({ result, basePath, sort, dir, caption, staff = false }) {
  const { rows, page, pages, total } = result;
  const areaLabel = (id) => DELIVERY_AREAS.find((a) => a.id === id)?.short ?? id;

  return (
    <>
      <div className="table-scroll" role="region" aria-label={`${caption} (scrollable)`} tabIndex={0}>
        <table className="data-table">
          <caption>{caption}</caption>
          <thead>
            <tr>
              {COLUMNS.slice(0, 3).map((column) => (
                <SortHeader key={column.key} column={column} basePath={basePath} sort={sort} dir={dir} />
              ))}
              {staff && <th scope="col">Customer</th>}
              {staff && <th scope="col">Area</th>}
              <SortHeader column={COLUMNS[3]} basePath={basePath} sort={sort} dir={dir} />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <th scope="row" className="data-table__id">
                  {staff ? (
                    `#${row.id}`
                  ) : (
                    <Link href={`/orders/${row.id}`} className="data-table__link">
                      #{row.id}
                    </Link>
                  )}
                </th>
                <td>
                  <time dateTime={new Date(row.createdAt).toISOString()}>
                    {whenDate.format(new Date(row.createdAt))}{" "}
                    <span className="data-table__time">{whenTime.format(new Date(row.createdAt))}</span>
                  </time>
                </td>
                <td>
                  <span className={`status-pill status-pill--${row.status}`}>{STATUS_TEXT[row.status]}</span>
                </td>
                {staff && <td>{row.customer}</td>}
                {staff && <td>{areaLabel(row.area)}</td>}
                <td className="num">{birr.format(row.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="table-count" role="status">
        Showing page {page} of {pages} · {total} {total === 1 ? "order" : "orders"}
      </p>
      <Pager basePath={basePath} sort={sort} dir={dir} page={page} pages={pages} />
    </>
  );
}
