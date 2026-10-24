import type { Metadata } from "next";
import { Suspense } from "react";
import { ListingPageClient } from "./listing-client";

export const metadata: Metadata = { title: "Товар" };

export default function ListingPage() {
  return (
    <Suspense>
      <ListingPageClient />
    </Suspense>
  );
}
