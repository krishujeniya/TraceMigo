import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "TraceMigo development", short_name: "TraceMigo", lang: "en",
    description: "Development workspace. Learning features are still being built.",
    start_url: "/", display: "standalone", background_color: "#F6F8F5", theme_color: "#142D34",
    icons: [
      { src: "/brand/app-icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/brand/app-icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/brand/maskable-icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
