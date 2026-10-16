"use client";
// Add or edit a dish. It is a real form: fields are validated with lib/dish-validate.js (the
// same schema the API uses, so the browser's answer and the server's answer cannot disagree),
// the result is sent to POST /api/admin/dishes or PUT /api/admin/dishes/:id, and anything the
// server refuses (a duplicate name, a read-only disk, an expired session) is shown beside the
// form. Nothing here "pretends" to save: the success message appears only after a 2xx answer.
import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Button from "@/components/Button";
import Field from "@/app/checkout/Field";
import { DISH_CATEGORIES, DISH_LIMITS, validateDishInput } from "@/lib/dish-validate";
import DeleteDishButton from "./DeleteDishButton";

// Field order = order on screen = the order focus jumps to when something is wrong.
const FIELD_ORDER = ["name", "category", "price", "prepMinutes", "image", "shortDescription", "description", "ingredients"];

function toPayload(values) {
  return {
    name: values.name,
    category: values.category,
    price: values.price,
    prepMinutes: values.prepMinutes,
    spicy: values.spicy,
    vegan: values.vegan,
    image: values.image,
    shortDescription: values.shortDescription,
    description: values.description,
    ingredients: values.ingredients, // one per line; the schema splits it
  };
}

export default function DishForm({ mode, dish, imageOptions = [], showCreatedNotice = false }) {
  const router = useRouter();
  const formRef = useRef(null);
  const [values, setValues] = useState(
    dish ?? { name: "", category: DISH_CATEGORIES[0], price: "", prepMinutes: "", spicy: false, vegan: false, image: "", shortDescription: "", description: "", ingredients: "" }
  );
  const [touched, setTouched] = useState({});
  const [serverErrors, setServerErrors] = useState({});
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState(showCreatedNotice ? { type: "success", text: "Dish added to the menu." } : null);

  const clientErrors = validateDishInput(toPayload(values)).errors;
  // Show a field's problem once the person has been in it (or after a failed submit).
  const errorFor = (name) => (touched[name] ? clientErrors[name] : undefined) || serverErrors[name];

  const update = (name) => (event) => {
    const value = event.target.type === "checkbox" ? event.target.checked : event.target.value;
    setValues((current) => ({ ...current, [name]: value }));
    setServerErrors((current) => ({ ...current, [name]: undefined }));
    setMessage(null);
  };
  const touch = (name) => () => setTouched((current) => ({ ...current, [name]: true }));

  function focusFirst(errors) {
    const name = FIELD_ORDER.find((field) => errors[field]);
    if (name) formRef.current?.querySelector(`[name="${name}"]`)?.focus();
  }

  async function onSubmit(event) {
    event.preventDefault();
    if (pending) return;
    setMessage(null);

    const { errors } = validateDishInput(toPayload(values));
    if (Object.keys(errors).length > 0) {
      setTouched(Object.fromEntries(FIELD_ORDER.map((name) => [name, true])));
      setMessage({ type: "error", text: "Fix the highlighted fields, then save again." });
      focusFirst(errors);
      return;
    }

    setPending(true);
    try {
      const response = await fetch(mode === "edit" ? `/api/admin/dishes/${encodeURIComponent(dish.id)}` : "/api/admin/dishes", {
        method: mode === "edit" ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toPayload(values)),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (response.status === 422 && data.fieldErrors) {
          setServerErrors(data.fieldErrors);
          setMessage({ type: "error", text: "The server did not accept some fields. Fix them and save again." });
          focusFirst(data.fieldErrors);
        } else if (response.status === 401 || response.status === 403) {
          setMessage({ type: "error", text: "Your admin session has ended. Sign in again, then save." });
        } else {
          setMessage({ type: "error", text: data.error || `The dish was not saved (error ${response.status}).` });
        }
        return;
      }

      if (mode === "create") {
        router.push(`/admin/dishes/${encodeURIComponent(data.dish.id)}?notice=created`);
      } else {
        setMessage({ type: "success", text: "Changes saved. The menu shows them now." });
        router.refresh();
      }
    } catch {
      setMessage({ type: "error", text: "Could not reach the server. Check your connection and try again." });
    } finally {
      setPending(false);
    }
  }

  return (
    <form ref={formRef} className="dish-form" onSubmit={onSubmit} noValidate>
      <p className={`admin-message${message ? ` admin-message--${message.type}` : ""}`} role={message?.type === "error" ? "alert" : "status"}>
        {message?.text}
      </p>

      <div className="dish-form__grid">
        <Field label="Name" htmlFor="dish-name" error={errorFor("name")}>
          <input id="dish-name" name="name" type="text" value={values.name} maxLength={DISH_LIMITS.name[1] + 20} onChange={update("name")} onBlur={touch("name")} required />
        </Field>

        <Field label="Category" htmlFor="dish-category" error={errorFor("category")}>
          <select id="dish-category" name="category" value={values.category} onChange={update("category")} onBlur={touch("category")}>
            {DISH_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Price (ETB)" htmlFor="dish-price" error={errorFor("price")}>
          <input id="dish-price" name="price" type="text" inputMode="numeric" value={values.price} onChange={update("price")} onBlur={touch("price")} required />
        </Field>

        <Field label="Preparation time (minutes)" htmlFor="dish-prep" error={errorFor("prepMinutes")}>
          <input id="dish-prep" name="prepMinutes" type="text" inputMode="numeric" value={values.prepMinutes} onChange={update("prepMinutes")} onBlur={touch("prepMinutes")} required />
        </Field>
      </div>

      <Field label="Photo (optional)" htmlFor="dish-image" error={errorFor("image")}>
        <input id="dish-image" name="image" type="text" list="dish-image-options" value={values.image} placeholder="/images/Doro Wot Deluxe.jpg" onChange={update("image")} onBlur={touch("image")} />
      </Field>
      <datalist id="dish-image-options">
        {imageOptions.map((path) => (
          <option key={path} value={path} />
        ))}
      </datalist>
      <p className="dish-form__hint">
        Photos are files in the project&apos;s <code>public/images</code> folder; pick one from the list or type its path. Uploading new photos is not part of this console.
        Leave it empty to show the placeholder.
      </p>

      <Field label="Short description (shown on the menu card)" htmlFor="dish-short" error={errorFor("shortDescription")}>
        <textarea id="dish-short" name="shortDescription" rows={2} value={values.shortDescription} onChange={update("shortDescription")} onBlur={touch("shortDescription")} required />
      </Field>

      <Field label="Description (shown on the dish page)" htmlFor="dish-description" error={errorFor("description")}>
        <textarea id="dish-description" name="description" rows={5} value={values.description} onChange={update("description")} onBlur={touch("description")} required />
      </Field>

      <Field label="Key ingredients (one per line, up to 12)" htmlFor="dish-ingredients" error={errorFor("ingredients")}>
        <textarea id="dish-ingredients" name="ingredients" rows={5} value={values.ingredients} onChange={update("ingredients")} onBlur={touch("ingredients")} />
      </Field>

      <fieldset className="dish-form__flags">
        <legend>Tags</legend>
        <label className="check">
          <input type="checkbox" name="spicy" checked={values.spicy} onChange={update("spicy")} />
          <span>Spicy</span>
        </label>
        <label className="check">
          <input type="checkbox" name="vegan" checked={values.vegan} onChange={update("vegan")} />
          <span>Vegan</span>
        </label>
      </fieldset>

      <div className="dish-form__actions">
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Saving…" : mode === "edit" ? "Save changes" : "Add dish"}
        </Button>
        <Button as={Link} href="/admin/dishes" variant="secondary">
          Back to dishes
        </Button>
        {mode === "edit" && <DeleteDishButton id={dish.id} name={dish.name} size="md" />}
      </div>
    </form>
  );
}
