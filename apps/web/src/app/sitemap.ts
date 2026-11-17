import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://tracemigo.com";
  const now = new Date();
  return [
    { url: `${base}/`, lastModified: now, changeFrequency: "daily", priority: 1.0 },
    { url: `${base}/catalog`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/catalog/python`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/cases/python/token-bucket`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/diagnostic`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/methodology`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/pricing`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/privacy`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/terms`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
  ];
}
