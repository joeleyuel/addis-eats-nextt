// Server component: markup only. The two interactive bits (photo fallback and
// the add button) are client leaves that receive plain props.
import Link from "next/link";
import FoodImage from "./FoodImage";
import AddToCartButton from "./AddToCartButton";
import { formatETB } from "@/lib/format";
import "./DishCard.css";

export default function DishCard({ dish }) {
  const cartDish = { id: dish.id, name: dish.name, price: dish.price, image: dish.image, category: dish.category };

  return (
    <article className="dish-card">
      <Link href={`/menu/${dish.id}`} className="dish-card__media">
        <FoodImage
          src={dish.image}
          alt={dish.name}
          width={400}
          height={300}
          sizes="(max-width: 640px) 100vw, (max-width: 1100px) 33vw, 280px"
        />
        <span className="dish-card__category">{dish.category}</span>
      </Link>
      <div className="dish-card__body">
        <Link href={`/menu/${dish.id}`} className="dish-card__title-link">
          <h3>{dish.name}</h3>
        </Link>
        <p className="dish-card__desc">{dish.shortDescription}</p>
        <div className="dish-card__meta">
          {/* A dish an admin has just added has no reviews yet: say "New", not "★ 0.0". */}
          <span className="dish-card__rating">{dish.reviews > 0 ? `★ ${dish.rating.toFixed(1)}` : "New"}</span>
          <span aria-hidden="true">·</span>
          <span>{dish.prepTime}</span>
        </div>
        <div className="dish-card__footer">
          <span className="dish-card__price">{formatETB(dish.price)}</span>
          <AddToCartButton dish={cartDish} />
        </div>
      </div>
    </article>
  );
}
