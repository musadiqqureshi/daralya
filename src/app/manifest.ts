import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Dar Al-Aaliya Dates | دار العالية للتمور",
    short_name: "Dar Al-Aaliya",
    description: "Premium Saudi dates — wholesale and retail — from Al-Awali, Madinah.",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f2e8",
    theme_color: "#173d32",
    lang: "ar",
    dir: "auto",
    icons: [
      { src: "/icon.svg", type: "image/svg+xml", sizes: "any" },
      { src: "/apple-icon", type: "image/png", sizes: "180x180" },
      { src: "/brand-logo.png", type: "image/png", sizes: "512x512", purpose: "any" },
    ],
  };
}
