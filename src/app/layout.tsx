import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { Toaster } from "@/components/ui";
import "@fontsource-variable/onest";
import "@fontsource-variable/unbounded";
import "./globals.css";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const DESCRIPTION =
  "Скины, игровая валюта и услуги по CS2, PUBG, Roblox, Minecraft, Fortnite, Brawl Stars, Standoff 2 и Valorant в сумах. Демонстрационная версия: реальные деньги не переводятся.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "UZMARKET GAMING — игровой маркетплейс Узбекистана",
    template: "%s · UZMARKET GAMING",
  },
  description: DESCRIPTION,
  openGraph: {
    type: "website",
    siteName: "UZMARKET GAMING",
    locale: "ru_RU",
    title: "UZMARKET GAMING — игровой маркетплейс Узбекистана",
    description: DESCRIPTION,
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: "#13141a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru">
      <body>
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[200] focus:rounded-lg focus:bg-accent focus:px-3 focus:py-2 focus:text-white">
          Перейти к содержимому
        </a>
        <Header />
        <main id="main" className="container-page py-8 sm:py-10">
          {children}
        </main>
        <Footer />
        <Toaster />
      </body>
    </html>
  );
}
