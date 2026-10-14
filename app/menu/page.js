import { queryDishes } from "@/lib/dishes";
import { normalizeCategory } from "@/lib/categories";
import { DISHES_PAGE_SIZE, parsePage } from "@/lib/paging";
import MenuBrowser from "./MenuBrowser";

// The menu accepts ?category= and ?page=, so it declares one canonical URL: every
// filtered or paged variant counts as /menu for a crawler.
export const metadata = {
  title: "Menu",
  description:
    "Browse Ethiopian stews, tibs, pizza, burgers and drinks from Addis kitchens. Search the menu and order for delivery across Addis Ababa.",
  alternates: { canonical: "/menu" },
};

// Dynamic (ƒ): the page number lives in the query string (?page=2&category=Pizza),
// so the server has to read searchParams to render the right first view. That
// makes the link shareable and indexable; it costs the hourly ISR cache the
// route had on Day 40 (the menu file is a cheap read). See STRATEGY.md.
export const dynamic = "force-dynamic";

// Server component: renders the requested page of dishes with real data and hands
// it to MenuBrowser as fallbackData, so there is no spinner on arrival. SWR takes
// over for search and for every later page.
export default async function MenuPage({ searchParams }) {
  const query = { category: normalizeCategory(searchParams.category), page: parsePage(searchParams.page) };
  const initialData = await queryDishes({ ...query, pageSize: DISHES_PAGE_SIZE });

  return (
    <div className="container section">
      <p className="eyebrow">Addis Ababa Kitchens</p>
      <h1>Explore Menu</h1>
      <p className="menu-lead">
        Explore authentic Ethiopian dishes, fresh wood-fired pizza, artisan burgers, and Addis signature
        beverages crafted across local favorites.
      </p>

      <MenuBrowser initialData={initialData} initialQuery={query} />
    </div>
  );
}
