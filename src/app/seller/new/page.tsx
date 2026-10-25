"use client";

import { ListingForm } from "@/components/listing-form";
import { PageHeader } from "@/components/ui";

export default function NewListingPage() {
  return (
    <div>
      <PageHeader title="Продать товар" subtitle="Заполните форму, посмотрите предпросмотр и опубликуйте. Покупатель увидит условия и итоговую сумму до оформления заказа." />
      <ListingForm />
    </div>
  );
}
