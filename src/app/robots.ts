import type { MetadataRoute } from "next";

export const dynamic = "force-static";

const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000") + (process.env.NEXT_PUBLIC_BASE_PATH ?? "");

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/account", "/seller", "/orders", "/checkout"] },
    sitemap: `${SITE}/sitemap.xml`,
  };
}
