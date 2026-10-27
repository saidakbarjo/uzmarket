import type { MetadataRoute } from "next";

export const dynamic = "force-static";

const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000") + (process.env.NEXT_PUBLIC_BASE_PATH ?? "");
const PATHS = ["/", "/catalog", "/about", "/support", "/legal/terms", "/legal/privacy", "/legal/rules", "/legal/refunds"];

export default function sitemap(): MetadataRoute.Sitemap {
  return PATHS.map((p) => ({ url: `${SITE}${p === "/" ? "" : p}` }));
}
