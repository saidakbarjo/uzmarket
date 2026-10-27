"use client";

import { Heart } from "lucide-react";
import { ListingCard } from "@/components/listing-card";
import { RequireAuth } from "@/components/require-auth";
import { EmptyState, PageHeader } from "@/components/ui";
import { useDemoState } from "@/lib/store";

export default function FavoritesPage() {
  const s = useDemoState();
  return (
    <RequireAuth>
      {(user) => {
        const ids = s.favorites[user.id] ?? [];
        const items = s.listings.filter((l) => ids.includes(l.id));
        return (
          <div>
            <PageHeader title="Избранное" subtitle={`Сохранено: ${items.length}`} />
            {items.length === 0 ? (
              <EmptyState
                icon={<Heart className="h-7 w-7" aria-hidden />}
                title="В избранном пока пусто"
                text="Нажмите на сердечко в карточке товара, чтобы сохранить его здесь."
                action={{ href: "/catalog", label: "Перейти в каталог" }}
              />
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:gap-5 xl:grid-cols-3">
                {items.map((l) => (
                  <ListingCard key={l.id} listing={l} />
                ))}
              </div>
            )}
          </div>
        );
      }}
    </RequireAuth>
  );
}
