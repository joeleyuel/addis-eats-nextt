import Link from "next/link";
import { requireAdmin } from "@/lib/admin-auth";
import { queryDishes } from "@/lib/dishes";
import { CATEGORIES } from "@/lib/categories";
import { formatETB } from "@/lib/format";
import { DISH_DEFAULTS, listHref, parseDishParams } from "@/lib/admin-filters";
import Button from "@/components/Button";
import EmptyState from "@/components/EmptyState";
import FoodImage from "@/components/FoodImage";
import PageHeader from "../../_components/PageHeader";
import Pagination from "../../_components/Pagination";
import DeleteDishButton from "../../_components/DeleteDishButton";

export const metadata = { title: "Dishes" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 10;

// Only these fixed messages can appear: text from the URL is never printed, so a crafted link
// cannot put words in front of an admin.
const NOTICES = {
  deleted: "Dish deleted. It is no longer on the menu.",
};

export default async function AdminDishesPage({ searchParams }) {
  await requireAdmin("/admin/dishes");
  const params = parseDishParams(searchParams);
  const result = await queryDishes({ q: params.q, category: params.category, page: params.page, pageSize: PAGE_SIZE });

  const hrefWith = (changes) => listHref("/admin/dishes", { ...params, ...changes }, DISH_DEFAULTS);
  const filtered = Boolean(params.q || params.category !== "All");
  const notice = typeof searchParams.notice === "string" ? NOTICES[searchParams.notice] : undefined;

  return (
    <>
      <PageHeader
        title="Dishes"
        lead="What customers can order. Changes appear on the menu straight away."
        actions={
          <Button as={Link} href="/admin/dishes/new" variant="primary">
            Add a dish
          </Button>
        }
      />

      {notice && (
        <p className="admin-message admin-message--success" role="status">
          {notice}
        </p>
      )}

      <form className="admin-filters" method="get" action="/admin/dishes" role="search" aria-label="Search dishes">
        <div className="field">
          <label htmlFor="d-q">Search</label>
          <input id="d-q" name="q" type="search" defaultValue={params.q} placeholder="Name or description" maxLength={100} />
        </div>
        <div className="field">
          <label htmlFor="d-category">Category</label>
          <select id="d-category" name="category" defaultValue={params.category}>
            {CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category === "All" ? "All categories" : category}
              </option>
            ))}
          </select>
        </div>
        <div className="admin-filters__buttons">
          <Button type="submit" variant="primary">
            Apply
          </Button>
          {filtered && (
            <Button as={Link} href="/admin/dishes" variant="secondary">
              Clear
            </Button>
          )}
        </div>
      </form>

      {result.total === 0 ? (
        filtered ? (
          <EmptyState
            icon="🔎"
            title="No dishes match"
            message="Try a different search or category."
            action={
              <Button as={Link} href="/admin/dishes" variant="secondary">
                Clear filters
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon="🍲"
            title="The menu is empty"
            message="Add the first dish so customers have something to order."
            action={
              <Button as={Link} href="/admin/dishes/new" variant="primary">
                Add a dish
              </Button>
            }
          />
        )
      ) : (
        <>
          <div className="table-scroll" role="region" aria-label="Dishes (scrollable)" tabIndex={0}>
            <table className="data-table">
              <caption className="visually-hidden">Dishes on the menu</caption>
              <thead>
                <tr>
                  <th scope="col">Dish</th>
                  <th scope="col">Category</th>
                  <th scope="col" className="num">
                    Price (ETB)
                  </th>
                  <th scope="col">Tags</th>
                  <th scope="col">Rating</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((dish) => (
                  <tr key={dish.id}>
                    <th scope="row" className="admin-dish-cell">
                      <span className="admin-thumb">
                        <FoodImage src={dish.image} alt="" width={56} height={42} sizes="56px" />
                      </span>
                      <Link href={`/admin/dishes/${dish.id}`} className="data-table__link">
                        {dish.name}
                      </Link>
                    </th>
                    <td>{dish.category}</td>
                    <td className="num" title={formatETB(dish.price)}>
                      {dish.price}
                    </td>
                    <td>
                      {dish.spicy && <span className="tag">Spicy</span>}
                      {dish.vegan && <span className="tag">Vegan</span>}
                      {!dish.spicy && !dish.vegan && <span className="admin-sub">None</span>}
                    </td>
                    <td>{dish.reviews > 0 ? `★ ${dish.rating.toFixed(1)} (${dish.reviews})` : "New"}</td>
                    <td>
                      <div className="admin-row-actions">
                        <Button as={Link} href={`/admin/dishes/${dish.id}`} variant="secondary" size="sm" aria-label={`Edit ${dish.name}`}>
                          Edit
                        </Button>
                        <DeleteDishButton id={dish.id} name={dish.name} returnTo={hrefWith({})} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="table-count" role="status">
            Showing page {result.page} of {result.totalPages} · {result.total} {result.total === 1 ? "dish" : "dishes"}
          </p>
          <Pagination page={result.page} pages={result.totalPages} hrefFor={(n) => hrefWith({ page: n })} />
        </>
      )}
    </>
  );
}
