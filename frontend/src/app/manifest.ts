import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Job Hunt Companion",
    short_name: "Job Hunt",
    description: "Track applications and referrals, and know what to follow up on today.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#f3f5f7",
    theme_color: "#17212b",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
