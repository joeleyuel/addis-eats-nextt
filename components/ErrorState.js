import Button from "./Button.js";
import "./EmptyState.css";

// Feature 14 — Error Handling, shown wherever a fetch can fail
export default function ErrorState({
  title = "Something went wrong",
  message,
  onRetry,
  retryLabel = "Try again",
  action,
}) {
  return (
    <div className="empty-state" role="alert">
      <div className="empty-state__icon" aria-hidden="true">
        ⚠️
      </div>
      <h3>{title}</h3>
      <p>{message || "We couldn't load this right now."}</p>
      {(onRetry || action) && (
        <div className="empty-state__action">
          {onRetry && (
            <Button variant="secondary" onClick={onRetry}>
              {retryLabel}
            </Button>
          )}
          {action}
        </div>
      )}
    </div>
  );
}
