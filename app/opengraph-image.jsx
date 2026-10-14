// Site-wide social preview (1200 × 630). A reserved file name: it is used for every
// page that does not have its own opengraph-image (/menu/[id] does). Satori only
// supports flexbox and basic CSS, so every container sets display: "flex".
import { ImageResponse } from "next/og";

export const alt = "Addis Eats — food delivery in Addis Ababa";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "0 90px",
          background: "#c1440e",
          color: "#ffffff",
        }}
      >
        <div style={{ display: "flex", fontSize: 40, fontWeight: 700, color: "#fdece4" }}>Addis Eats</div>
        <div style={{ display: "flex", fontSize: 92, fontWeight: 800, lineHeight: 1.1, marginTop: 24 }}>
          Delicious food, delivered in Addis.
        </div>
        <div style={{ display: "flex", fontSize: 36, marginTop: 36, color: "#fdece4" }}>
          Doro Wat · Tibs · Kitfo · Shiro — pay with Telebirr
        </div>
      </div>
    ),
    { ...size }
  );
}
