import Link from "next/link";
import { getDishes } from "@/lib/dishes";
import DishCard from "@/components/DishCard";
import Button from "@/components/Button";
import FoodImage from "@/components/FoodImage";
import "./home.css";

// No title here: the root default ("Addis Eats — food delivery in Addis Ababa") is the home title.
export const metadata = {
  description:
    "Fresh Doro Wat, Tibs, Kitfo and Shiro from Addis kitchens, at your door in about 30 minutes. Pay with Telebirr, CBE Birr or cash.",
  alternates: { canonical: "/" },
};

const SPECIAL_IDS = ["doro-wot-deluxe", "sizzling-shekla-tibs", "addis-special-kitfo", "gourmet-beyaynetu"];

// Static (○): nobody in particular is asking and the specials are a curated
// list, so the page is rendered once at build time.
export default async function HomePage() {
  const dishes = await getDishes();
  const specials = dishes.filter((dish) => SPECIAL_IDS.includes(dish.id));

  return (
    <div>
      <section className="hero">
        <div className="container hero__grid">
          <div>
            <p className="eyebrow">Addis Ababa · 30–45m drop-off · Telebirr &amp; CBE ready</p>
            <h1 className="hero__title">
              Delicious food, <span className="hero__accent">delivered in Addis.</span>
            </h1>
            <p className="hero__lead">
              Authentic Ethiopian traditional stews, sizzling tibs, and farm-fresh fasting delights brought
              straight to your doorstep across Bole, Kazanchis, Old Airport, and beyond.
            </p>
            <div className="hero__actions">
              <Button as={Link} href="/menu" variant="primary" size="lg">
                Explore Menu →
              </Button>
              <Button as={Link} href="/menu" variant="secondary" size="lg">
                Today&apos;s Specials
              </Button>
            </div>
            <dl className="hero__stats">
              <div>
                <dt>140+</dt>
                <dd>Local eateries</dd>
              </div>
              <div>
                <dt>32m</dt>
                <dd>Avg delivery</dd>
              </div>
              <div>
                <dt>4.9★</dt>
                <dd>Customer love</dd>
              </div>
            </dl>
          </div>
          <div className="hero__media">
            <FoodImage
              src="https://farm8.staticflickr.com/7380/10306762905_89a731d88b_o.jpg"
              alt="A traditional Ethiopian feast spread on injera"
              width={1000}
              height={800}
              sizes="(max-width: 800px) 100vw, 560px"
              priority
            />
          </div>
        </div>
      </section>

      <section className="container section">
        <div className="feature-strip">
          <div className="feature-strip__item">
            <span aria-hidden="true">🍽️</span>
            <div>
              <h3>Authentic &amp; Fresh</h3>
              <p>Cooked to order every morning by Addis Ababa&apos;s finest culinary institutions and home cooks.</p>
            </div>
          </div>
          <div className="feature-strip__item">
            <span aria-hidden="true">⚡</span>
            <div>
              <h3>Swift Delivery</h3>
              <p>Real-time motorbike tracking from Bole and Kazanchis all the way to CMC and Sarbet.</p>
            </div>
          </div>
          <div className="feature-strip__item">
            <span aria-hidden="true">💳</span>
            <div>
              <h3>Easy Local Pay</h3>
              <p>Seamless checkout with Telebirr, CBE Birr mobile PIN, or cash hand-off at your door.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="container section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Handpicked daily curations</p>
            <h2>Today&apos;s Specials</h2>
            <p>Chef&apos;s curated favorites with special prices · Fresh batches ready now</p>
          </div>
          <Link href="/menu" className="section-heading__link">
            View full menu →
          </Link>
        </div>

        <div className="grid-cards">
          {specials.map((dish) => (
            <DishCard key={dish.id} dish={dish} />
          ))}
        </div>
      </section>

      <section className="container section">
        <div className="promo-banner">
          <div>
            <p className="eyebrow eyebrow--light">First time on Addis Eats?</p>
            <h2>Order with confidence across Addis Ababa</h2>
            <p className="promo-banner__lead">
              Enjoy freshly prepared authentic meals with guaranteed rapid delivery to Bole, Kazanchis,
              Piassa, and beyond.
            </p>
            <div className="promo-banner__code">
              <span>PROMO CODE</span>
              <strong>ADDISFIRST</strong>
            </div>
          </div>
          <Button as={Link} href="/menu" variant="accent" size="lg">
            Claim Discount &amp; Order
          </Button>
        </div>
      </section>
    </div>
  );
}
