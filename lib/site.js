// Day 44 — one place that knows the public URL and site name.
// NEXT_PUBLIC_SITE_URL is baked in at build time (see .env.example). The default is
// the production URL from the Day 44 sheet, never localhost: a localhost metadataBase
// is the classic "works locally, not live" bug for social previews.
export const SITE_NAME = "Addis Eats";
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://addiseats.et").replace(/\/+$/, "");

export function absoluteUrl(pathname = "/") {
  return new URL(pathname, SITE_URL + "/").href;
}
