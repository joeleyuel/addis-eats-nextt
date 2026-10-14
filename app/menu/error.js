"use client";
// error.js must be a client component (it receives `reset`). It replaces only
// the menu segment, so the header and cart stay alive.
import Link from "next/link";
import ErrorState from "@/components/ErrorState";
import Button from "@/components/Button";

// `error` is available here for logging; the message shown to customers is fixed.
export default function MenuError({ reset }) {
  return (
    <div className="container section">
      <ErrorState
        title="We couldn't load the menu"
        message="Something went wrong while loading the menu. Please try again."
        onRetry={reset}
        action={
          <Button as={Link} href="/" variant="secondary">
            Back to Home
          </Button>
        }
      />
    </div>
  );
}
