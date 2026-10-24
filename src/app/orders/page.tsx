import type { Metadata } from "next";
import { Suspense } from "react";
import { OrderPageClient } from "./order-client";

export const metadata: Metadata = { title: "Заказ" };

export default function OrderPage() {
  return (
    <Suspense>
      <OrderPageClient />
    </Suspense>
  );
}
