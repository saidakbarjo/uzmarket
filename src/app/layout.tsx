import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { Toaster } from "@/components/ui";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "UZMARKET GAMING — игровой маркетплейс Узбекистана",
    template: "%s · UZMARKET GAMING",
  },
  description:
    "Скины, игровая валюта и услуги по CS2, PUBG, Roblox, Minecraft, Fortnite, Brawl Stars, Standoff 2 и Valorant в сумах. Демонстрационная версия: реальные деньги не переводятся.",
};

export const viewport: Viewport = {
  themeColor: "#0a0d16",
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
        <main id="main" className="container-page animate-fade-up py-8 sm:py-10">
          {children}
        </main>
        <Footer />
        <Toaster />
      </body>
    </html>
  );
}
