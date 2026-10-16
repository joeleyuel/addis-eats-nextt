"use client";
// Deletes a dish through DELETE /api/admin/dishes/:id after a confirmation. `returnTo` is the
// list URL to come back to (built on the server from the current filters).
import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/Button";
import ConfirmDialog from "./ConfirmDialog";

export default function DeleteDishButton({ id, name, returnTo = "/admin/dishes", size = "sm" }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function remove() {
    setPending(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/dishes/${encodeURIComponent(id)}`, { method: "DELETE" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(
          response.status === 401 || response.status === 403
            ? "Your admin session has ended. Sign in again, then retry."
            : data.error || `The dish was not deleted (error ${response.status}).`
        );
        return;
      }
      const url = new URL(returnTo, window.location.origin);
      url.searchParams.set("notice", "deleted");
      setOpen(false);
      router.push(`${url.pathname}${url.search}`);
      router.refresh();
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Button type="button" variant="danger" size={size} onClick={() => setOpen(true)} aria-label={`Delete ${name}`}>
        Delete
      </Button>
      {error && !open && (
        <p className="admin-message admin-message--error" role="alert">
          {error}
        </p>
      )}
      <ConfirmDialog
        open={open}
        title={`Delete “${name}”?`}
        confirmLabel="Delete dish"
        pending={pending}
        onConfirm={remove}
        onCancel={() => {
          setOpen(false);
          setError("");
        }}
      >
        <p>It leaves the menu straight away and its page stops working. Orders already placed keep their own copy of the dish&apos;s name and price. This cannot be undone.</p>
        {error && (
          <p className="admin-message admin-message--error" role="alert">
            {error}
          </p>
        )}
      </ConfirmDialog>
    </>
  );
}
