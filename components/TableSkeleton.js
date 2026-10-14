// Day 46: a skeleton the SHAPE of the content (a heading and five table rows) tells
// people what to expect and reserves the space, so nothing jumps when the data lands.
// Used by the loading.js of /orders and /dashboard.
export default function TableSkeleton({ title, rows = 5, withCharts = false }) {
  return (
    <div className="container section" aria-busy="true">
      <h1>{title}</h1>
      <p className="visually-hidden" role="status">
        Loading…
      </p>
      {withCharts && <div className="skeleton skeleton--chart" aria-hidden="true" />}
      <div className="skeleton-rows" aria-hidden="true">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="skeleton skeleton--row" />
        ))}
      </div>
    </div>
  );
}
