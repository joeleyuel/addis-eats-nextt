// One tailored 1200 × 630 card per dish, rendered on the server from the dish record.
// Flexbox only (no grid), every multi-child container is display: "flex".
import { ImageResponse } from "next/og";
import { getDishById, getDishes } from "@/lib/dishes";

export const alt = "Addis Eats dish";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export async function generateStaticParams() {
  const dishes = await getDishes();
  return dishes.map((dish) => ({ id: dish.id }));
}

export default async function Image({ params }) {
  const dish = await getDishById(params.id);
  const name = dish ? dish.name : "Dish not found";
  const price = dish ? `${dish.price} ETB` : "";
  const category = dish ? dish.category.toUpperCase() : "ADDIS EATS";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "70px 90px",
          background: "#fdece4",
          color: "#201c2b",
        }}
      >
        <div style={{ display: "flex", fontSize: 38, fontWeight: 700, color: "#c1440e" }}>
          Addis Eats · {category}
        </div>
        <div style={{ display: "flex", fontSize: name.length > 24 ? 84 : 104, fontWeight: 800, lineHeight: 1.1 }}>
          {name}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", fontSize: 64, fontWeight: 800, color: "#c1440e" }}>{price}</div>
          <div style={{ display: "flex", fontSize: 34, color: "#6c6679" }}>Delivered across Addis Ababa</div>
        </div>
      </div>
    ),
    { ...size }
  );
}
