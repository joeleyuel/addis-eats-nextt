import Link from "next/link";
import Button from "@/components/Button";
import EmptyState from "@/components/EmptyState";

export const metadata = {
  title: "Page not found",
  description: "This page or dish could not be found. It may have been removed from the Addis Eats menu.",
};

// Rendered for unknown URLs and for notFound() calls (e.g. /menu/not-a-dish).
// It sits inside the root layout, so the header and cart survive.
export default function NotFound() {
  return (
    <div className="container section">
      <EmptyState
        icon="🧭"
        title="Page not found"
        headingLevel={1}
        message="The page or dish you're looking for doesn't exist. It may have been removed from the menu."
        action={
          <Button as={Link} href="/menu" variant="primary">
            Back to the menu
          </Button>
        }
      />
    </div>
  );
}
