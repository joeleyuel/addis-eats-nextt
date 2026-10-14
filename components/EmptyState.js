import "./EmptyState.css";

// Feature 13 — Empty States
// headingLevel: 3 by default (it sits under a page h1); a page with no other heading,
// such as not-found, passes 1 so it still has exactly one h1.
export default function EmptyState({ icon = "🍽️", title, message, action, headingLevel = 3 }) {
  const Heading = `h${headingLevel}`;
  return (
    <div className="empty-state">
      <div className="empty-state__icon" aria-hidden="true">
        {icon}
      </div>
      <Heading>{title}</Heading>
      {message && <p>{message}</p>}
      {action && <div className="empty-state__action">{action}</div>}
    </div>
  );
}
