import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin-auth";
import { getDishById } from "@/lib/dishes";
import { parsePrepMinutes } from "@/lib/dish-validate";
import { listDishImages } from "@/lib/images";
import PageHeader from "../../../_components/PageHeader";
import DishForm from "../../../_components/DishForm";

export const metadata = { title: "Edit dish" };
export const dynamic = "force-dynamic";

export default async function EditDishPage({ params, searchParams }) {
  await requireAdmin(`/admin/dishes/${encodeURIComponent(params.id)}`);
  const dish = await getDishById(params.id);
  if (!dish) notFound();

  // Plain strings for the form's fields (id, rating and reviews are not editable and stay in the file).
  const initial = {
    id: dish.id,
    name: dish.name,
    category: dish.category,
    price: String(dish.price),
    prepMinutes: String(parsePrepMinutes(dish.prepTime) ?? ""),
    spicy: Boolean(dish.spicy),
    vegan: Boolean(dish.vegan),
    image: dish.image || "",
    shortDescription: dish.shortDescription || "",
    description: dish.description || "",
    ingredients: (dish.ingredients || []).join("\n"),
  };

  return (
    <>
      <Link href="/admin/dishes" className="admin-back">
        ← All dishes
      </Link>
      <PageHeader
        title={dish.name}
        lead={
          <>
            Shown to customers at{" "}
            <Link href={`/menu/${dish.id}`} className="admin-link">
              /menu/{dish.id}
            </Link>
            . The address stays the same if you rename the dish.
          </>
        }
      />
      <section className="dashboard__card">
        <DishForm mode="edit" dish={initial} imageOptions={await listDishImages()} showCreatedNotice={searchParams.notice === "created"} />
      </section>
    </>
  );
}
