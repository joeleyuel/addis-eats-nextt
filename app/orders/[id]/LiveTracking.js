"use client";
// Client because EventSource and the map are browser-only (Day 47).
//
//  · SEEDED from the server render (`initial`), so nobody watches a spinner for a value
//    the server already had; the stream only updates it.
//  · CLOSED on unmount and deliberately when the server says `done` — an unclosed
//    EventSource survives navigation and leaves a connection open per visit.
//  · The connection state is always visible: live / reconnecting / paused. A screen that
//    quietly stops updating looks identical to one where nothing has happened.
//  · If the stream cannot be used at all (no EventSource, or the server answers with an
//    error rather than a stream) it falls back to polling the ordinary status endpoint
//    every 5 s — Day 41's SWR approach, still the simplest thing that works.
import { useEffect, useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { KITCHEN } from "@/lib/delivery";
import { STATUS_LABELS } from "../OrderStatus";
import MapPanel from "./MapPanel";

const CONNECTION_TEXT = {
  connecting: "Connecting…",
  live: "Live",
  reconnecting: "Reconnecting…",
  polling: "Live updates paused — checking every 5 s",
  closed: "Tracking complete",
};

function courierText(live) {
  if (live.status === "cancelled") return "No courier — the order was cancelled.";
  if (live.status === "on_the_way") {
    return live.arrived ? "The courier has reached the delivery area (simulated)." : "On the way to you (simulated position).";
  }
  return "Waiting at the kitchen while your food is prepared.";
}

export default function LiveTracking({ id, initial, area, address, eta }) {
  const [live, setLive] = useState(initial);
  const [connection, setConnection] = useState(initial.done ? "closed" : "connecting");

  useEffect(() => {
    if (initial.done) return undefined;
    if (typeof EventSource === "undefined") {
      setConnection("polling");
      return undefined;
    }
    const source = new EventSource(`/api/orders/${encodeURIComponent(id)}/stream`);
    source.onopen = () => setConnection("live");
    source.onmessage = (event) => {
      let data;
      try {
        data = JSON.parse(event.data);
      } catch {
        return; // a malformed message must never break the page
      }
      setLive(data);
      if (data.done) {
        setConnection("closed");
        source.close(); // delivered or cancelled: nothing more will change
      } else {
        setConnection("live");
      }
    };
    source.onerror = () => {
      // CONNECTING: the browser is retrying by itself. CLOSED: it gave up (the server
      // answered 401/404/500 instead of a stream) — poll instead.
      setConnection(source.readyState === EventSource.CLOSED ? "polling" : "reconnecting");
    };
    return () => source.close(); // Day 29, still essential
  }, [id, initial.done]);

  // Polling fallback: a null key means "do not fetch".
  const polled = useSWR(connection === "polling" ? `/api/orders/${encodeURIComponent(id)}` : null, fetcher, {
    refreshInterval: 5000,
  });
  const status = (connection === "polling" && polled.data?.order?.status) || live.status;
  const shown = { ...live, status };

  return (
    <>
      <div className="live-status">
        <p className="order-status" role="status" aria-live="polite">
          {STATUS_LABELS[status] || STATUS_LABELS.received}
        </p>
        <span className={`live-indicator live-indicator--${connection}`}>
          <span className="live-indicator__dot" aria-hidden="true" />
          {CONNECTION_TEXT[connection]}
        </span>
      </div>

      <MapPanel kitchen={KITCHEN} delivery={area.center} courier={shown.courier} areaLabel={area.label} />

      {/* The same information in words: tiles and pins mean nothing to a screen reader. */}
      <dl className="order-facts" style={{ marginTop: 16 }}>
        <dt>Delivering to</dt>
        <dd>{area.label}</dd>
        <dt>Address</dt>
        <dd>{address}</dd>
        <dt>Estimated time</dt>
        <dd>{eta}</dd>
        <dt>Courier</dt>
        <dd>{courierText(shown)}</dd>
      </dl>
      <p className="map-note">
        Demo: there is no courier app, so the courier position is simulated. The 📍 marks the approximate centre of{" "}
        {area.label}, not your exact address.
      </p>
    </>
  );
}
