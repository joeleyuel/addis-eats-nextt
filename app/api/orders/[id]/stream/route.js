import { getSession } from "@/lib/session";
import { getOrderFor, getTracking } from "@/lib/orders";

// GET /api/orders/AE-12345/stream — live order status over server-sent events (Day 47).
// Ordinary HTTP, so it passes through proxies and needs no new infrastructure.
//
// Same rules as every other order read: 401 without a session, and someone else's
// order is indistinguishable from a missing one (404). The check happens BEFORE the
// stream is opened.
//
// SSE framing is strict: "data: " + the payload + TWO newlines. One newline and the
// browser waits forever for a message that never completes. Chunks must be bytes
// (TextEncoder), not strings, or Node's Response rejects them.
export const dynamic = "force-dynamic";

const TICK_MS = 3000;
// Serverless hosts cut long responses. Close politely before that happens; the browser
// reconnects by itself (see `retry:`) and the first message of every connection is the
// current state, so nothing is lost across the gap.
const MAX_STREAM_MS = 25_000;

export async function GET(request, { params }) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Sign in to view orders." }, { status: 401 });
  const order = getOrderFor(params.id, session);
  if (!order) return Response.json({ error: "Order not found." }, { status: 404 });

  const encoder = new TextEncoder();
  let timer;
  let closed = false;

  const stream = new ReadableStream({
    start(controller) {
      const close = () => {
        if (closed) return;
        closed = true;
        clearInterval(timer);
        try {
          controller.close();
        } catch {
          // already closed by the client going away
        }
      };
      const send = () => {
        const payload = getTracking(order);
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
        return payload;
      };

      controller.enqueue(encoder.encode("retry: 1000\n\n"));
      // Current state first, immediately — the page is already seeded from the server
      // render, so this only confirms it.
      if (send().done) return close();

      const startedAt = Date.now();
      timer = setInterval(() => {
        try {
          if (send().done || Date.now() - startedAt > MAX_STREAM_MS) close();
        } catch {
          close();
        }
      }, TICK_MS);
      request.signal.addEventListener("abort", close);
    },
    cancel() {
      closed = true;
      clearInterval(timer);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
