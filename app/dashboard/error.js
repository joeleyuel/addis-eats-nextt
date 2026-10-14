"use client";
// The error state: what failed, and a way to retry. The message is deliberately generic
// — the real error stays in the server log.
import { useEffect } from "react";
import ErrorState from "@/components/ErrorState";

export default function DashboardError({ error, reset }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="container section">
      <h1>Dashboard</h1>
      <ErrorState
        title="We couldn't load the dashboard"
        message="Something went wrong on our side while preparing the numbers. Nothing has been lost — try again."
        onRetry={reset}
      />
    </div>
  );
}
