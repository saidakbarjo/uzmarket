"use client";

import Link from "next/link";
import { Heart } from "lucide-react";
import { ListingCard } from "@/components/listing-card";
import { EmptyState, Notice, PageHeader } from "@/components/ui";
import { useGuestFavorites } from "@/lib/guest";
import { useCurrentUser, useDemoState } from "@/lib/store";

export function FavoritesView() {
  const s = useDemoState();
  const { user, ready } = useCurrentUser();
  const guest = useGuestFavorites();
  if (!ready) return null;
  const ids = user ? (s.favorites[user.id] ?? []) : guest;
  const items = s.listings.filter((l) => ids.includes(l.id));
  return (
    <div>
      <PageHeader title="Избранное" subtitle={`Сохранено: ${items.length}`} />
      {!user && (
        <div className="mb-5">
          <Notice tone="info">
            Избранное сохранено только в этом браузере. <Link href="/login?next=/favorites" className="font-semibold text-accent hover:underline">Войдите</Link> — оно добавится в ваш аккаунт.
          </Notice>
        </div>
      )}
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
}
