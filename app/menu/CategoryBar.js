"use client";
// Client leaf: selection state is reported through onSelect, a callback that
// only ever travels between two client components (MenuBrowser → here).
import { CATEGORIES } from "@/lib/categories";
import "./category-bar.css";

export default function CategoryBar({ active, onSelect }) {
  return (
    <div className="category-bar" role="group" aria-label="Filter by category">
      {CATEGORIES.map((category) => (
        <button
          key={category}
          type="button"
          aria-pressed={active === category}
          className={`category-pill${active === category ? " category-pill--active" : ""}`}
          onClick={() => onSelect(category)}
        >
          {category}
        </button>
      ))}
    </div>
  );
}
