"use client";

import { ListingForm } from "@/components/listing-form";
import { RequireAuth } from "@/components/require-auth";
import { PageHeader } from "@/components/ui";

export default function NewListingPage() {
  return (
    <RequireAuth>
      {() => (
        <div>
          <PageHeader title="Новое объявление" subtitle="Опишите товар или услугу — покупатель увидит всё до оформления заказа." />
          <ListingForm />
        </div>
      )}
    </RequireAuth>
  );
}
