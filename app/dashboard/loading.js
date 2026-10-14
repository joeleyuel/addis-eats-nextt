import TableSkeleton from "@/components/TableSkeleton";

// The loading state: the shape of the page (heading, a chart, five rows), not a spinner.
export default function Loading() {
  return <TableSkeleton title="Dashboard" withCharts />;
}
