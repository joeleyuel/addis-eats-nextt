"use client";
// Client leaf: it needs onError to swap in a placeholder when a third-party
// photo disappears. Day 43: now a thin wrapper over next/image, so every photo is
// resized, served as AVIF/WebP, lazy-loaded and has its space reserved.
// width/height are the ASPECT RATIO (not display size); sizes tells the browser
// how wide the image really is on screen. `priority` is opt-in, one image only.
import { useState } from "react";
import Image from "next/image";

const FALLBACK_SRC =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 640 480'>" +
      "<rect width='640' height='480' fill='#f1e6d8'/>" +
      "<text x='320' y='270' font-size='110' text-anchor='middle'>🍲</text></svg>"
  );

export default function FoodImage({ src, alt, width, height, sizes, priority = false, ...props }) {
  const [failedSrc, setFailedSrc] = useState(null);
  const useFallback = !src || failedSrc === src;
  return (
    <Image
      src={useFallback ? FALLBACK_SRC : src}
      alt={alt}
      width={width}
      height={height}
      sizes={sizes}
      priority={priority}
      onError={() => setFailedSrc(src)}
      {...props}
    />
  );
}
