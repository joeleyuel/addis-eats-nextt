"use client";
// The error state for /orders and /orders/[id]: what failed, and a way to retry. The
// message is deliberately generic — the real error stays in the server log.
import { useEffect } from "react";
import Link from "next/link";
import Button from "@/components/Button";
import ErrorState from "@/components/ErrorState";

export default function OrdersError({ error, reset }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="container section">
      <h1>My orders</h1>
      <ErrorState
        title="We couldn't load your orders"
        message="Something went wrong on our side. Your orders are safe — try again."
        onRetry={reset}
        action={
          <Button as={Link} href="/menu" variant="ghost">
            Browse the menu
          </Button>
        }
      />
    </div>
  );
}
