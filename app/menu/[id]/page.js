import Link from "next/link";
import { notFound } from "next/navigation";
import { getDishById, getDishes } from "@/lib/dishes";
import FoodImage from "@/components/FoodImage";
import AddToCartButton from "@/components/AddToCartButton";
import { formatETB } from "@/lib/format";
import { SITE_NAME, absoluteUrl } from "@/lib/site";
import "./dish-detail.css";

// Static via params (●): we know every id at build time, so each dish page is
// prerendered. Unknown ids are rendered on demand and end in notFound().
export async function generateStaticParams() {
  const dishes = await getDishes();
  return dishes.map((dish) => ({ id: dish.id }));
}

// Runs on the server before the page renders; getDishById is wrapped in cache(),
// so calling it here and in the page costs one read. Everything is derived from the
// dish record, so no two dishes share a description. The dish's og:image comes from
// the opengraph-image.jsx file in this folder.
export async function generateMetadata({ params }) {
  const dish = await getDishById(params.id);
  if (!dish) return { title: "Dish not found" };
  const description = `${dish.name} — ${dish.price} ETB. ${dish.shortDescription}`;
  return {
    title: dish.name,
    description,
    alternates: { canonical: `/menu/${dish.id}` },
    openGraph: {
      title: `${dish.name} · Addis Eats`,
      description,
      url: `/menu/${dish.id}`,
      siteName: SITE_NAME,
      type: "website",
      locale: "en_ET",
    },
  };
}

export default async function DishPage({ params }) {
  const dish = await getDishById(params.id);
  if (!dish) notFound();

  const cartDish = { id: dish.id, name: dish.name, price: dish.price, image: dish.image, category: dish.category };

  // Structured data built from the SAME dish object the page renders below: the name
  // and price here are the ones shown in the <h1> and the price line (in ETB).
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "MenuItem",
    name: dish.name,
    description: dish.description,
    image: absoluteUrl(dish.image),
    offers: { "@type": "Offer", price: dish.price, priceCurrency: "ETB" },
  };

  return (
    <div className="container section dish-detail">
      {/* "<" is escaped so a dish name can never close the script tag early. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\u003c") }}
      />
      <Link href="/menu" className="dish-detail__back">
        ← Back to Menu
      </Link>

      <div className="dish-detail__grid">
        <div className="dish-detail__media">
          <FoodImage
            src={dish.image}
            alt={dish.name}
            width={800}
            height={600}
            sizes="(max-width: 800px) 100vw, 600px"
          />
        </div>

        <div className="dish-detail__info">
          <p className="dish-detail__category">
            {dish.category.toUpperCase()} · {dish.spicy ? "Spiced" : "Mild"}
          </p>
          <div className="dish-detail__heading">
            <h1>{dish.name}</h1>
          </div>
          <p className="dish-detail__rating">
            ★ {dish.rating.toFixed(1)} ({dish.reviews} reviews)
          </p>
          <p className="dish-detail__price">{formatETB(dish.price)}</p>
          <p className="dish-detail__desc">{dish.description}</p>

          {dish.ingredients?.length > 0 && (
            <div className="dish-detail__ingredients">
              <h2>Key ingredients &amp; flavors</h2>
              <ul>
                {dish.ingredients.map((ingredient) => (
                  <li key={ingredient}>{ingredient}</li>
                ))}
              </ul>
            </div>
          )}

          <AddToCartButton dish={cartDish} withQuantity />
        </div>
      </div>
    </div>
  );
}
