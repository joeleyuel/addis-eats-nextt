import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin-auth";
import { adminOrderDetail } from "@/lib/orders";
import { getDeliveryArea } from "@/lib/delivery";
import { birr, etb, formatWhen } from "@/lib/format";
import PageHeader from "../../../_components/PageHeader";
import StatusPill from "../../../_components/StatusPill";
import OrderStatusForm from "../../../_components/OrderStatusForm";

export const metadata = { title: "Order" };
export const dynamic = "force-dynamic";

// The ONE place a full phone number and street address are shown: the person delivering the
// order needs them. Lists and search results show a masked number only.
export default async function AdminOrderPage({ params }) {
  const session = await requireAdmin(`/admin/orders/${encodeURIComponent(params.id)}`);
  const order = adminOrderDetail(params.id, session);
  if (!order) notFound();
  const area = getDeliveryArea(order.area);

  return (
    <>
      <Link href="/admin/orders" className="admin-back">
        ← All orders
      </Link>
      <PageHeader
        title={`Order #${order.id}`}
        lead={`Placed ${formatWhen(order.createdAt)}${order.updatedAt ? ` · last changed ${formatWhen(order.updatedAt)} by ${order.updatedBy}` : ""}`}
        actions={<StatusPill status={order.status} />}
      />

      <div className="admin-two-col admin-two-col--wide-left">
        <section className="dashboard__card" aria-labelledby="items-heading">
          <h2 id="items-heading">Items</h2>
          <div className="table-scroll" role="region" aria-label="Order items (scrollable)" tabIndex={0}>
            <table className="data-table">
              <caption className="visually-hidden">Dishes in this order, with the price at the time of the order</caption>
              <thead>
                <tr>
                  <th scope="col">Dish</th>
                  <th scope="col" className="num">
                    Qty
                  </th>
                  <th scope="col" className="num">
                    Price (ETB)
                  </th>
                  <th scope="col" className="num">
                    Line (ETB)
                  </th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((line) => (
                  <tr key={line.id}>
                    <th scope="row">{line.name}</th>
                    <td className="num">{line.quantity}</td>
                    <td className="num">{birr.format(line.price)}</td>
                    <td className="num">{birr.format(line.price * line.quantity)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <dl className="admin-totals">
            <div>
              <dt>Subtotal</dt>
              <dd>{etb.format(order.subtotal)}</dd>
            </div>
            <div>
              <dt>Delivery fee</dt>
              <dd>{etb.format(order.deliveryFee)}</dd>
            </div>
            <div className="admin-totals__total">
              <dt>Total</dt>
              <dd>{etb.format(order.total)}</dd>
            </div>
          </dl>
        </section>

        <div>
          <section className="dashboard__card" aria-labelledby="status-heading">
            <h2 id="status-heading">Status</h2>
            <OrderStatusForm orderId={order.id} current={order.status} />
            <p className="admin-help">
              {order.manual
                ? "This status was set by hand and stays until someone changes it."
                : "Until you set a status here, it moves on by itself as the order gets older (received, preparing, on the way). Once you set one, it stays put."}{" "}
              Choosing another status for a cancelled order reinstates it.
            </p>
          </section>

          <section className="dashboard__card" aria-labelledby="customer-heading">
            <h2 id="customer-heading">Customer and delivery</h2>
            <dl className="admin-facts">
              <div>
                <dt>Name</dt>
                <dd>{order.customer.name}</dd>
              </div>
              <div>
                <dt>Phone</dt>
                <dd>
                  <a href={`tel:${order.customer.phone.replace(/[^\d+]/g, "")}`} className="admin-link">
                    {order.customer.phone}
                  </a>
                </dd>
              </div>
              <div>
                <dt>Area</dt>
                <dd>{area?.label ?? order.area}</dd>
              </div>
              <div>
                <dt>Address</dt>
                <dd>{order.address}</dd>
              </div>
              <div>
                <dt>Instructions</dt>
                <dd>{order.instructions || "None"}</dd>
              </div>
            </dl>
          </section>
        </div>
      </div>
    </>
  );
}
