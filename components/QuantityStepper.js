// Presentational (no state of its own): the cart's − / count / + control. Buttons are 44 px
// square, labelled for screen readers, and the count is announced when it changes.
import "./QuantityStepper.css";

export default function QuantityStepper({ name, quantity, max, onChange }) {
  return (
    <div className="stepper" role="group" aria-label={`Quantity of ${name}`}>
      <button
        type="button"
        className="stepper__btn"
        onClick={() => onChange(quantity - 1)}
        aria-label={quantity <= 1 ? `Remove ${name} from cart` : `Decrease ${name} quantity`}
      >
        <span aria-hidden="true">−</span>
      </button>
      <span className="stepper__count" aria-live="polite">
        {quantity}
      </span>
      <button
        type="button"
        className="stepper__btn"
        onClick={() => onChange(quantity + 1)}
        disabled={quantity >= max}
        aria-label={`Increase ${name} quantity`}
      >
        <span aria-hidden="true">+</span>
      </button>
    </div>
  );
}
