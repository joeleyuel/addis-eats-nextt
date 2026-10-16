// Server component. Page links are real URLs (back button, middle-click and "send a colleague
// page three of the cancelled orders" all work). `hrefFor(n)` builds the URL for page n and
// keeps the active filters; it is a function, which is fine here because both sides are
// server components.
import Link from "next/link";
import { pageWindow } from "@/lib/order-table";

export default function Pagination({ page, pages, hrefFor }) {
  if (pages <= 1) return null;
  return (
    <nav className="table-pager" aria-label="Pagination">
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} className="table-pager__link" rel="prev" prefetch={false}>
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
                href={hrefFor(n)}
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
        <Link href={hrefFor(page + 1)} className="table-pager__link" rel="next" prefetch={false}>
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
