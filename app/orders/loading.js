import TableSkeleton from "@/components/TableSkeleton";

// The loading state: a skeleton shaped like five table rows, so the page does not jump
// when the real table arrives. Covers /orders and /orders/[id].
export default function Loading() {
  return <TableSkeleton title="My orders" />;
}
