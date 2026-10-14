// The one fetcher every SWR query in the app uses (no directive: it is plain
// code, safe to import from any client component).
//
// SWR treats a thrown error as `error`, so a non-OK response MUST throw —
// fetch() only rejects on network failure, never on a 404 or 500.
export class FetchError extends Error {
  constructor(message, { status, info } = {}) {
    super(message);
    this.name = "FetchError";
    this.status = status;
    this.info = info;
  }
}

export async function fetcher(url) {
  let response;
  try {
    response = await fetch(url);
  } catch {
    throw new FetchError("Could not reach the server. Check your connection and try again.");
  }

  if (!response.ok) {
    // Our API answers failures as { error: "…" }; fall back to the status code.
    let info;
    try {
      info = await response.json();
    } catch {
      // Not JSON (e.g. a proxy error page) — the status is all we have.
    }
    throw new FetchError(info?.error || `Request failed with status ${response.status}.`, {
      status: response.status,
      info,
    });
  }

  return response.json();
}
