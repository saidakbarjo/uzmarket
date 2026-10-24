import type { Metadata } from "next";
import { Suspense } from "react";
import { ListingGridSkeleton } from "@/components/listing-card";
import { CatalogClient } from "./catalog-client";

export const metadata: Metadata = { title: "Каталог" };

export default function CatalogPage() {
  return (
    <Suspense fallback={<ListingGridSkeleton />}>
      <CatalogClient />
    </Suspense>
  );
}
