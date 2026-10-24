"use client";

import { ShieldAlert } from "lucide-react";
import { ListingForm } from "@/components/listing-form";
import { RequireAuth } from "@/components/require-auth";
import { EmptyState, Notice, PageHeader } from "@/components/ui";
import { useDemoState } from "@/lib/store";

export function EditListingClient({ id }: { id: string }) {
  const s = useDemoState();
  return (
    <RequireAuth>
      {(user) => {
        const listing = s.listings.find((l) => l.id === id);
        if (!listing) return <EmptyState title="Объявление не найдено" action={{ href: "/seller", label: "К моим объявлениям" }} />;
        if (listing.sellerId !== user.id && user.role !== "admin") {
          return <EmptyState icon={<ShieldAlert className="h-7 w-7" aria-hidden />} title="Это не ваше объявление" text="Редактировать можно только собственные объявления." action={{ href: "/seller", label: "К моим объявлениям" }} />;
        }
        return (
          <div>
            <PageHeader title="Редактирование" subtitle={listing.title} />
            <Notice className="mb-6">Изменение цены не влияет на уже созданные заказы: их сумма зафиксирована.</Notice>
            <ListingForm key={listing.id} existing={listing} />
          </div>
        );
      }}
    </RequireAuth>
  );
}
