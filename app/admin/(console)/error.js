"use client";
// The error state: what failed, and a way to retry. The real error stays in the server log.
import { useEffect } from "react";
import ErrorState from "@/components/ErrorState";

export default function AdminError({ error, reset }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div>
      <h1>Admin</h1>
      <ErrorState
        title="We couldn't load this screen"
        message="Something went wrong on our side. Nothing has been changed — try again."
        onRetry={reset}
      />
    </div>
  );
}
