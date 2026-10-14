// Day 46: "all four states implemented and demonstrable on demand". Adding
// ?demo=loading | empty | error to /orders or /dashboard forces that state, so each can be
// shown without a slow network, a fresh account or a broken server. It only ever changes
// what the page SHOWS (a delay, an empty list, a thrown error) — it never reveals or
// alters data, and the page's own session and role checks still run first.
export const DEMO_DELAY_MS = 3000;

export function demoMode(searchParams) {
  const raw = Array.isArray(searchParams?.demo) ? searchParams.demo[0] : searchParams?.demo;
  return raw === "loading" || raw === "empty" || raw === "error" ? raw : null;
}

export async function applyDemo(mode) {
  if (mode === "loading") await new Promise((resolve) => setTimeout(resolve, DEMO_DELAY_MS));
  if (mode === "error") throw new Error("Demo error: this failure was requested with ?demo=error.");
}
