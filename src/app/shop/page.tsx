import type { Metadata } from "next";
import { Suspense } from "react";
import { ShopClient } from "./shop-client";

export const metadata: Metadata = { title: "Продавец" };

export default function ShopPage() {
  return (
    <Suspense>
      <ShopClient />
    </Suspense>
  );
}
