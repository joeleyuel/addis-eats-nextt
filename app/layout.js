import localFont from "next/font/local";
import "./globals.css";
import "./layout.css";
import Providers from "@/components/Providers";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { SITE_NAME, SITE_URL } from "@/lib/site";

// next/font: fetched once at build time and served from our own origin. No request
// to Google at runtime, no flash of the wrong face, matched fallback metrics.
const manrope = localFont({
  src: "../public/fonts/manrope.ttf",
  display: "swap",
  variable: "--font-manrope",
  weight: "500 800",
});

const inter = localFont({
  src: "../public/fonts/inter.woff2",
  display: "swap",
  variable: "--font-inter",
  weight: "400 900",
});

// Root layout: metadataBase (so every relative og:image becomes an absolute URL),
// the title template (pages supply only their own part) and site-wide defaults.
export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    template: "%s · Addis Eats",
    default: "Addis Eats — food delivery in Addis Ababa",
  },
  description:
    "Order Doro Wat, Tibs and Kitfo from kitchens in Bole and Kazanchis. Delivery across Addis Ababa, paid with Telebirr.",
  openGraph: {
    siteName: SITE_NAME,
    title: "Addis Eats — food delivery in Addis Ababa",
    description:
      "Order Doro Wat, Tibs and Kitfo from kitchens in Bole and Kazanchis. Delivery across Addis Ababa, paid with Telebirr.",
    type: "website",
    locale: "en_ET",
  },
  icons: {
    icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ctext y='.9em' font-size='90'%3E🍲%3C/text%3E%3C/svg%3E",
  },
};

// Server component. It reads no cookies or headers, so it never forces a route
// dynamic. Providers is the only client wrapper and receives the page as children.
export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${manrope.variable} ${inter.variable}`}>
      <body>
        <Providers>
          <div className="app-shell">
            <a href="#main-content" className="skip-link">
              Skip to content
            </a>
            <SiteHeader />
            <main id="main-content">{children}</main>
            <SiteFooter />
          </div>
        </Providers>
      </body>
    </html>
  );
}
