import type { Metadata } from "next";
import { Suspense } from "react";
import { CheckoutClient } from "./checkout-client";

export const metadata: Metadata = { title: "Оформление заказа" };

export default function CheckoutPage() {
  return (
    <Suspense>
      <CheckoutClient />
    </Suspense>
  );
}
