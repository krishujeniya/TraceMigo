import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: [
        "/",
        "/catalog",
        "/catalog/",
        "/cases/",
        "/diagnostic",
        "/methodology",
        "/pricing",
        "/privacy",
        "/terms",
        "/login",
        "/register",
      ],
      disallow: [
        "/workspace/",
        "/history",
        "/history/",
        "/settings",
        "/settings/",
        "/billing",
        "/billing/",
        "/admin/",
        "/api/",
      ],
    },
    sitemap: "https://tracemigo.com/sitemap.xml",
  };
}
