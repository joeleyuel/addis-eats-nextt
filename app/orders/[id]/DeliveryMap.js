"use client";
// The map itself (Day 47). Loaded ONLY through MapPanel, with ssr:false: Leaflet touches
// `window` the moment it is imported, so importing it anywhere that renders on the
// server crashes the build.
//
// Three things people forget, all done here: the stylesheet is imported (or tiles render
// broken), the container has an explicit height (CSS `.delivery-map`), and the
// attribution is kept — it is a licence condition, not decoration.
//
// Positions are [lat, lng] — Leaflet order. GeoJSON is [lng, lat]; reversing them puts
// Bole in the Indian Ocean. The OpenStreetMap public tile server is fine for coursework
// and NOT for production traffic (see its tile usage policy).
//
// Pins are emoji divIcons: Leaflet's default marker images are resolved relative to its
// CSS and break under bundlers, and a divIcon needs no image file at all.
import { useEffect } from "react";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

const pin = (emoji) =>
  L.divIcon({
    className: "",
    html: `<div class="map-pin" aria-hidden="true">${emoji}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 26],
    popupAnchor: [0, -24],
  });
const KITCHEN_ICON = pin("🍲");
const COURIER_ICON = pin("🛵");
const DELIVERY_ICON = pin("📍");

// Fits the kitchen and the delivery area on screen. The courier always moves between
// them, so the view is fitted once (and again only if those two points change) — it does
// not jump back while someone is panning during live updates.
function FitToRoute({ kitchen, delivery }) {
  const map = useMap();
  useEffect(() => {
    map.fitBounds(L.latLngBounds([kitchen, delivery]), { padding: [40, 40], maxZoom: 15 });
  }, [map, kitchen, delivery]);
  return null;
}

export default function DeliveryMap({ kitchen, delivery, courier, areaLabel }) {
  return (
    <MapContainer
      center={delivery}
      zoom={13}
      className="delivery-map"
      scrollWheelZoom={false}
      aria-label={`Map of the delivery route to ${areaLabel}`}
    >
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        maxZoom={19}
      />
      <FitToRoute kitchen={kitchen.position} delivery={delivery} />
      <Marker position={kitchen.position} icon={KITCHEN_ICON} alt="Kitchen">
        <Popup>{kitchen.name}</Popup>
      </Marker>
      <Marker position={delivery} icon={DELIVERY_ICON} alt="Delivery area">
        <Popup>Delivery: {areaLabel} (approximate area centre)</Popup>
      </Marker>
      {courier && (
        <Marker position={courier} icon={COURIER_ICON} alt="Courier" zIndexOffset={500}>
          <Popup>Courier (simulated position)</Popup>
        </Marker>
      )}
    </MapContainer>
  );
}
