import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || "https://apacci-exchange.com";

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/send"],
        disallow: [
          "/admin",
          "/admin/*",
          "/profile",
          "/profile/*",
          "/recipients",
          "/recipients/*",
          "/transactions",
          "/transactions/*",
          "/api/*",
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
