import type { NextConfig } from "next";

/**
 * Обычный режим (npm run dev / build / start) — без изменений.
 * Статическая публикация (GitHub Pages): STATIC_EXPORT=1 и NEXT_PUBLIC_BASE_PATH=/uzmarket,
 * см. README → «Публикация на GitHub Pages».
 */
const isStatic = process.env.STATIC_EXPORT === "1";
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || undefined;

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  ...(isStatic ? { output: "export", trailingSlash: true, images: { unoptimized: true } } : {}),
  ...(basePath ? { basePath } : {}),
};

export default nextConfig;
