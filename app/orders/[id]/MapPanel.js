"use client";
// Loads the map without server rendering. `ssr: false` is not an optimisation here — it
// is the only way Leaflet can load at all (it reads `window` on import). The placeholder
// has exactly the map's height, so the page does not jump when the map arrives.
import dynamic from "next/dynamic";

const DeliveryMap = dynamic(() => import("./DeliveryMap"), {
  ssr: false,
  loading: () => <div className="delivery-map" aria-hidden="true" />,
});

export default function MapPanel(props) {
  return <DeliveryMap {...props} />;
}
