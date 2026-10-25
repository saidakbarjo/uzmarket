"use client";

import { useSearchParams } from "next/navigation";
import { BadgeCheck, CalendarDays } from "lucide-react";
import { ListingCard } from "@/components/listing-card";
import { Avatar, EmptyState, Stars, formatDate } from "@/components/ui";
import { useDemoState } from "@/lib/store";

/** Публичный профиль продавца: рейтинг, статистика, товары и отзывы. */
export function ShopClient() {
  const id = useSearchParams().get("id") ?? "";
  const s = useDemoState();
  const seller = s.profiles.find((p) => p.id === id && p.isSeller && !p.blocked);
  if (!seller) return <EmptyState title="Продавец не найден" action={{ href: "/catalog", label: "В каталог" }} />;
  const sp = s.sellerProfiles.find((x) => x.userId === seller.id);
  const enabled = new Set(s.games.filter((g) => g.enabled).map((g) => g.slug));
  const listings = s.listings.filter((l) => l.sellerId === seller.id && l.status === "active" && enabled.has(l.gameSlug));
  const reviews = s.reviews.filter((r) => r.sellerId === seller.id && !s.hiddenReviewIds.includes(r.id)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <div className="space-y-10">
      <section className="card flex flex-wrap items-center gap-5 p-6">
        <Avatar user={seller} className="h-20 w-20 !text-3xl" />
        <div className="min-w-0 flex-1">
          <h1 className="flex flex-wrap items-center gap-2 font-display text-2xl font-bold">
            {sp?.shopName ?? seller.username}
            {seller.verified && <BadgeCheck className="h-5 w-5 text-accent-2" aria-label="Проверенный продавец" />}
          </h1>
          <p className="text-sm text-muted">@{seller.username}</p>
          {(sp?.about || seller.about) && <p className="mt-2 max-w-2xl text-sm">{sp?.about || seller.about}</p>}
        </div>
        <dl className="grid grid-cols-3 gap-5 text-center text-sm">
          <div><dt className="text-muted">Рейтинг</dt><dd className="flex items-center justify-center gap-1 font-semibold">{seller.reviewsCount ? <><Stars value={seller.rating} size="h-3.5 w-3.5" /> {seller.rating.toFixed(1)}</> : "—"}</dd></div>
          <div><dt className="text-muted">Продаж</dt><dd className="font-semibold">{seller.salesCount}</dd></div>
          <div><dt className="text-muted">С нами</dt><dd className="flex items-center justify-center gap-1 font-semibold"><CalendarDays className="h-3.5 w-3.5 text-muted" aria-hidden />{formatDate(seller.createdAt)}</dd></div>
        </dl>
      </section>

      <section aria-labelledby="sl">
        <h2 id="sl" className="mb-5 font-display text-xl font-bold">Товары ({listings.length})</h2>
        {listings.length === 0 ? <p className="card p-5 text-sm text-muted">Активных объявлений нет.</p> : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">{listings.map((l) => <ListingCard key={l.id} listing={l} />)}</div>
        )}
      </section>

      <section aria-labelledby="sr">
        <h2 id="sr" className="mb-5 font-display text-xl font-bold">Отзывы ({reviews.length})</h2>
        {reviews.length === 0 ? <p className="card p-5 text-sm text-muted">Отзывов пока нет.</p> : (
          <ul className="space-y-3">
            {reviews.map((r) => (
              <li key={r.id} className="card p-4">
                <div className="flex items-center justify-between gap-2 text-sm"><span className="font-medium">{r.authorName}</span><span className="text-xs text-muted">{formatDate(r.createdAt)}</span></div>
                <div className="mt-1"><Stars value={r.rating} /></div>
                <p className="mt-2 text-sm">{r.text}</p>
                {r.sellerReply && <p className="mt-2 rounded-lg border-l-2 border-accent bg-panel-2 p-3 text-sm"><b className="text-xs text-accent">Ответ продавца:</b> {r.sellerReply.text}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
