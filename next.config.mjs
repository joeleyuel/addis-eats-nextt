// Day 43 — what we actually set: image hosts, redirects, security headers.
// Static rules live here (not in middleware) so middleware stays tiny.

// Every host that appears in data/menu-data.json or the home hero. An unlisted
// host throws at request time on purpose: it stops our optimiser resizing
// other people's images. Add a host here when you add a dish photo from it.
const IMAGE_HOSTS = [
  "itsonly.recipes",
  "harambeeafrica.com",
  "d1w7312wesee68.cloudfront.net",
  "ml8rqkav98fy.i.optimole.com",
  "holycowvegan.net",
  "www.pizzarelli.restaurant",
  "images.deliveryhero.io",
  "i.guim.co.uk",
  "www.cookedbyjulie.com",
  "altohabesha.com",
  "slice-menu-assets-prod.imgix.net",
  "jordan-bruno.github.io",
  "d3m4c209qf8hgy.cloudfront.net",
  "farm8.staticflickr.com",
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: IMAGE_HOSTS.map((hostname) => ({ protocol: "https", hostname })),
    formats: ["image/avif", "image/webp"],
  },
  async redirects() {
    // Old-style dish URL -> current one.
    return [{ source: "/dishes/:id", destination: "/menu/:id", permanent: true }];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
