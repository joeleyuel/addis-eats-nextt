// Built from the real dish records at build time: a dish added next month appears
// without anyone editing a file. Public pages only; /cart, /checkout, /orders,
// /kitchen and /signin are left out (and disallowed in robots.js).
import { getDishes } from "@/lib/dishes";
import { absoluteUrl } from "@/lib/site";

export default async function sitemap() {
  const dishes = await getDishes();
  return [
    { url: absoluteUrl("/"), priority: 1 },
    { url: absoluteUrl("/menu"), priority: 0.9 },
    ...dishes.map((dish) => ({ url: absoluteUrl(`/menu/${dish.id}`), priority: 0.7 })),
  ];
}
