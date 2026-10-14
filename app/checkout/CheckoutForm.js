"use client";
// Client because of the controlled fields, touched tracking and live fee.
// It is still a real <form action={placeOrder}>, so with JavaScript disabled the
// browser posts the same fields and the server action places the order.
// Everything it needs from the server arrives as plain data (lines, subtotal).
import { useEffect, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { placeOrder } from "@/app/actions";
import { validateCheckoutForm } from "@/lib/validate";
import { DELIVERY_AREAS, getDeliveryFee, getEstimatedDeliveryTime } from "@/lib/delivery";
import { etb } from "@/lib/format";
import Field from "./Field";
import Button from "@/components/Button";
import Link from "next/link";

const INITIAL_STATE = { message: "", errors: {}, values: null };

function SubmitButton({ total }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" size="lg" className="btn--full" disabled={pending} aria-disabled={pending}>
      {pending ? "Placing your order…" : `Place order · ${etb.format(total)}`}
    </Button>
  );
}

export default function CheckoutForm({ lines, subtotal, defaults, unavailable = 0 }) {
  const [state, formAction] = useFormState(placeOrder, INITIAL_STATE);

  const [fields, setFields] = useState({
    name: state.values?.name ?? defaults.name,
    phone: state.values?.phone ?? defaults.phone,
    area: state.values?.area ?? "",
    address: state.values?.address ?? "",
    instructions: state.values?.instructions ?? "",
  });
  // Touched tracking: a client-side error only shows once the customer has
  // visited the field, so the form never greets them with red text.
  const [touched, setTouched] = useState({});
  // Server errors stay until the customer edits that field again.
  const [edited, setEdited] = useState({});

  // A new response from the server: show its errors and focus the first one.
  useEffect(() => {
    setEdited({});
    const first = Object.keys(state.errors || {}).find((key) => key !== "items");
    if (first) document.getElementById(first)?.focus();
  }, [state]);

  function updateField(key, value) {
    setFields((prev) => ({ ...prev, [key]: value }));
    setEdited((prev) => ({ ...prev, [key]: true }));
  }

  function markTouched(key) {
    setTouched((prev) => (prev[key] ? prev : { ...prev, [key]: true }));
  }

  const clientErrors = validateCheckoutForm(fields);
  const errors = {};
  for (const key of ["name", "phone", "area", "address", "instructions"]) {
    errors[key] = (touched[key] && clientErrors[key]) || (!edited[key] && state.errors?.[key]) || undefined;
  }

  const deliveryFee = getDeliveryFee(fields.area);
  const total = subtotal + deliveryFee;

  return (
    <div className="container section checkout-page">
      <h1>Checkout</h1>
      <p className="checkout-page__lead">Tell us where to bring your food. Prices are confirmed by our server when you place the order.</p>

      {unavailable > 0 && (
        <p className="checkout-notice" role="status">
          {unavailable === 1 ? "One dish in your cart is" : `${unavailable} dishes in your cart are`} no longer on the menu and{" "}
          {unavailable === 1 ? "was" : "were"} left out of this order.
        </p>
      )}

      <div className="checkout-page__grid">
        <aside className="checkout-summary" aria-labelledby="order-summary-heading">
          <h2 id="order-summary-heading">Order summary</h2>
          <ul className="checkout-summary__list">
            {lines.map((line) => (
              <li key={line.id}>
                <span>
                  {line.quantity}× {line.name}
                </span>
                <span>{etb.format(line.price * line.quantity)}</span>
              </li>
            ))}
          </ul>
          <div className="checkout-summary__row">
            <span>Dishes subtotal</span>
            <span>{etb.format(subtotal)}</span>
          </div>
          <div className="checkout-summary__row">
            <span>Delivery fee</span>
            <span>{fields.area ? etb.format(deliveryFee) : "Choose an area"}</span>
          </div>
          <div className="checkout-summary__row checkout-summary__row--total">
            <span>Total</span>
            <span>{etb.format(total)}</span>
          </div>
          <Link href="/cart" className="checkout-summary__edit">
            ← Edit cart
          </Link>
        </aside>

        <form className="checkout-form" action={formAction} noValidate>
          {state.message && (
            <p className="checkout-form__message" role="alert">
              <span aria-hidden="true">⚠ </span>
              {state.message}
            </p>
          )}

          <fieldset className="checkout-section">
            <legend>1 · Who is it for?</legend>
            <Field label="Recipient full name" htmlFor="name" error={errors.name}>
              <input
                id="name"
                name="name"
                type="text"
                value={fields.name}
                onChange={(e) => updateField("name", e.target.value)}
                onBlur={() => markTouched("name")}
                autoComplete="name"
                enterKeyHint="next"
              />
            </Field>
            <Field label="Ethiopian mobile number" htmlFor="phone" error={errors.phone}>
              <input
                id="phone"
                name="phone"
                type="tel"
                inputMode="tel"
                placeholder="0911 234 567"
                value={fields.phone}
                onChange={(e) => updateField("phone", e.target.value)}
                onBlur={() => markTouched("phone")}
                autoComplete="tel"
                enterKeyHint="next"
              />
            </Field>
          </fieldset>

          <fieldset className="checkout-section">
            <legend>2 · Where should we bring it?</legend>
            <Field label="Delivery sub-city / neighborhood" htmlFor="area" error={errors.area}>
              <select
                id="area"
                name="area"
                value={fields.area}
                onChange={(e) => updateField("area", e.target.value)}
                onBlur={() => markTouched("area")}
              >
                <option value="">Select an area…</option>
                {DELIVERY_AREAS.map((area) => (
                  <option key={area.id} value={area.id}>
                    {area.label} · {etb.format(area.fee)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Building, house number & landmarks" htmlFor="address" error={errors.address}>
              <input
                id="address"
                name="address"
                type="text"
                placeholder="Near Friendship Business Center, House #402, 3rd Floor"
                value={fields.address}
                onChange={(e) => updateField("address", e.target.value)}
                onBlur={() => markTouched("address")}
                autoComplete="street-address"
                enterKeyHint="next"
              />
            </Field>
            <Field label="Special instructions (optional)" htmlFor="instructions" error={errors.instructions}>
              <textarea
                id="instructions"
                name="instructions"
                placeholder="e.g. Extra spicy mitmita, contactless drop-off at the gate…"
                value={fields.instructions}
                onChange={(e) => updateField("instructions", e.target.value)}
                onBlur={() => markTouched("instructions")}
              />
            </Field>
            {fields.area ? (
              <p className="delivery-estimate">⏱ Estimated delivery: {getEstimatedDeliveryTime(fields.area)}</p>
            ) : (
              <p className="delivery-estimate delivery-estimate--muted">Choose an area to see your delivery estimate.</p>
            )}
          </fieldset>

          <SubmitButton total={total} />
        </form>
      </div>
    </div>
  );
}
