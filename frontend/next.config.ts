import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cache Components and partial prefetching are off: every screen loads its data in the
  // browser from the API (the session cookie belongs to the API's origin), so there is no
  // server-side data for Next.js to cache or prefetch.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
