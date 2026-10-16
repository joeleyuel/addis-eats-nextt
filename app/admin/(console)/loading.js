// The loading state: the shape of an admin screen (a heading, a row of cards, table rows),
// not a spinner, so nothing jumps when the data lands. It sits inside the admin shell, so it
// does not add a container of its own.
export default function Loading() {
  return (
    <div aria-busy="true">
      <h1>Admin</h1>
      <p className="visually-hidden" role="status">
        Loading…
      </p>
      <div className="skeleton-rows" aria-hidden="true">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="skeleton skeleton--row" />
        ))}
      </div>
    </div>
  );
}
