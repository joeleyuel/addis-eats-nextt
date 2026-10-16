"use client";
// Order status moves with the clock and customers keep ordering, so a list that was right a
// minute ago may not be now. This is an opt-in switch: while it is on, the page's server data is
// re-fetched every `seconds` seconds (router.refresh keeps scroll position and anything typed).
// It is off by default so nothing changes under an admin's cursor unless they asked for it.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function AutoRefresh({ seconds = 30 }) {
  const router = useRouter();
  const [on, setOn] = useState(false);

  useEffect(() => {
    if (!on) return undefined;
    const timer = setInterval(() => {
      if (!document.hidden) router.refresh();
    }, seconds * 1000);
    return () => clearInterval(timer);
  }, [on, seconds, router]);

  return (
    <label className="auto-refresh">
      <input type="checkbox" checked={on} onChange={(event) => setOn(event.target.checked)} />
      <span>Refresh every {seconds} seconds</span>
    </label>
  );
}
