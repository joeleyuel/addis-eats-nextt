import { cloneElement, isValidElement } from "react";

// Small shared field wrapper for the checkout form, keeps label + error together
// and wires the error to the control for screen readers (aria-invalid / describedby).
// The error is plain text with a ⚠ marker, so it is readable without colour.
// Its Field wrapper is a flex column, so it sits directly under the control.
export default function Field({ label, htmlFor, error, children }) {
  const errorId = `${htmlFor}-error`;
  const control = isValidElement(children)
    ? cloneElement(children, {
        "aria-invalid": error ? "true" : undefined,
        "aria-describedby": error ? errorId : undefined,
      })
    : children;

  return (
    <div className="field">
      <label htmlFor={htmlFor}>{label}</label>
      {control}
      {error && (
        <span className="field-error" id={errorId} role="alert">
          <span aria-hidden="true">⚠ </span>
          {error}
        </span>
      )}
    </div>
  );
}
