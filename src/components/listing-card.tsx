"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { BadgeCheck, Clock, Heart } from "lucide-react";
import { formatUZS } from "@/lib/money";
import { toggleFavorite, useCurrentUser, useDemoState } from "@/lib/store";
import { toast } from "@/lib/toast";
import type { Listing } from "@/lib/types";
import { Avatar, Badge, DemoBadge, ListingImage, Stars } from "@/components/ui";
import { productTypeLabel } from "@/lib/product-types";
import { isInStock } from "@/lib/catalog";

export function FavoriteButton({ listingId, variant = "icon" }: { listingId: string; variant?: "icon" | "full" }) {
  const router = useRouter();
  const { user } = useCurrentUser();
  const s = useDemoState();
  const active = !!user && (s.favorites[user.id] ?? []).includes(listingId);

  function onClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      toast.info("Войдите, чтобы добавлять товары в избранное");
      router.push("/login?next=" + encodeURIComponent(window.location.pathname.replace(process.env.NEXT_PUBLIC_BASE_PATH ?? "", "") + window.location.search));
      return;
    }
    const r = toggleFavorite(listingId);
    if (r.ok) toast.success(r.data.favorited ? "Добавлено в избранное" : "Удалено из избранного");
    else toast.error(r.error);
  }

  if (variant === "full") {
    return (
      <button type="button" onClick={onClick} aria-pressed={active} className="btn-ghost w-full">
        <Heart className={`h-4 w-4 ${active ? "fill-danger text-danger" : ""}`} aria-hidden />
        {active ? "В избранном" : "В избранное"}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={active ? "Убрать из избранного" : "Добавить в избранное"}
      className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/40 backdrop-blur transition hover:bg-black/60"
    >
      <Heart className={`h-4 w-4 ${active ? "fill-danger text-danger" : "text-white"}`} aria-hidden />
    </button>
  );
}

export function ListingCard({ listing }: { listing: Listing }) {
  const s = useDemoState();
  const seller = s.profiles.find((p) => p.id === listing.sellerId);
  const game = s.games.find((g) => g.slug === listing.gameSlug);
  const inStock = isInStock(listing);

  return (
    <article className="card card-hover group relative flex flex-col overflow-hidden">
      <Link href={`/listing?id=${listing.id}`} className="absolute inset-0 z-10" aria-label={listing.title} />
      <div className="relative">
        <ListingImage gameSlug={listing.gameSlug} images={listing.images} hue={listing.imageHue} className="aspect-[16/10] w-full transition duration-300 group-hover:scale-[1.03]" />
        <div className="absolute left-3 top-3 z-20 flex gap-1.5">
          {listing.isDemo && <DemoBadge />}
          {!inStock && <Badge tone="danger">Нет в наличии</Badge>}
        </div>
        <div className="absolute right-3 top-3 z-20">
          <FavoriteButton listingId={listing.id} />
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <p className="text-xs font-medium text-accent">{game?.name} · {productTypeLabel(listing.productType)}</p>
        <h3 className="line-clamp-2 min-h-[2.75rem] text-[15px] font-semibold leading-snug">{listing.title}</h3>
        <div className="mt-auto flex items-center justify-between gap-3 text-xs text-muted">
          <span className="flex min-w-0 items-center gap-1.5">
            {seller && <Avatar user={seller} className="h-5 w-5 !text-[10px]" />}
            <span className="truncate font-medium text-ink/90">{seller?.username ?? "Продавец"}</span>
            {seller?.verified && <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-accent-2" aria-label="Проверенный продавец" />}
          </span>
          {seller && seller.reviewsCount > 0 && (
            <span className="flex shrink-0 items-center gap-1">
              <Stars value={seller.rating} size="h-3 w-3" />
              <span>{seller.rating.toFixed(1)}</span>
            </span>
          )}
        </div>
        <div className="flex items-end justify-between gap-2 border-t border-line pt-3">
          <p className="font-display text-lg font-bold">{formatUZS(listing.priceUzs)}</p>
          <span className="flex items-center gap-1 text-xs text-muted">
            <Clock className="h-3.5 w-3.5" aria-hidden />
            {listing.deliveryDays === 0 ? "сразу" : `до ${listing.deliveryDays} дн.`}
          </span>
        </div>
      </div>
    </article>
  );
}

export function ListingGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card overflow-hidden" aria-hidden>
          <div className="aspect-[16/10] animate-pulse bg-panel-2" />
          <div className="space-y-3 p-4">
            <div className="h-3 w-1/3 animate-pulse rounded bg-panel-2" />
            <div className="h-4 w-full animate-pulse rounded bg-panel-2" />
            <div className="h-4 w-2/3 animate-pulse rounded bg-panel-2" />
            <div className="h-6 w-1/2 animate-pulse rounded bg-panel-2" />
          </div>
        </div>
      ))}
    </div>
  );
}
