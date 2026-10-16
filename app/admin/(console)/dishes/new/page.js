import Link from "next/link";
import { requireAdmin } from "@/lib/admin-auth";
import { listDishImages } from "@/lib/images";
import PageHeader from "../../../_components/PageHeader";
import DishForm from "../../../_components/DishForm";

export const metadata = { title: "Add a dish" };
export const dynamic = "force-dynamic";

export default async function NewDishPage() {
  await requireAdmin("/admin/dishes/new");
  return (
    <>
      <Link href="/admin/dishes" className="admin-back">
        ← All dishes
      </Link>
      <PageHeader title="Add a dish" lead="It appears on the menu as soon as you save. Rating starts empty and fills in from customer reviews." />
      <section className="dashboard__card">
        <DishForm mode="create" imageOptions={await listDishImages()} />
      </section>
    </>
  );
}
