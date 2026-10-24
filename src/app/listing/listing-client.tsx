"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BadgeCheck, CalendarDays, Clock, Flag, Pencil, PackageCheck, RotateCcw, SearchX, ShieldAlert, ShoppingCart, Truck } from "lucide-react";
import { useMemo, useState } from "react";
import { FavoriteButton, ListingCard } from "@/components/listing-card";
import { Badge, DemoBadge, EmptyState, ListingImage, Notice, Stars, formatDate } from "@/components/ui";
import { categories } from "@/lib/data/seed";
import { calcFee, formatUZS, FEE_PERCENT } from "@/lib/money";
import { createOrder, useCurrentUser, useDemoState } from "@/lib/store";
import { toast } from "@/lib/toast";
import { averageRating } from "@/lib/catalog";

const DELIVERY_LABELS = {
  chat: "Передача в чате заказа",
  key: "Цифровой ключ / код",
  manual: "Выполняется продавцом вручную",
  file: "Файл или ссылка на скачивание",
} as const;

export function ListingClient({ id }: { id: string }) {
  const router = useRouter();
  const s = useDemoState();
  const { user, ready } = useCurrentUser();
  const [busy, setBusy] = useState(false);
  const [imgIdx, setImgIdx] = useState(0);

  const listing = s.listings.find((l) => l.id === id);
  const seller = listing ? s.profiles.find((p) => p.id === listing.sellerId) : undefined;
  const reviews = useMemo(
    () => s.reviews.filter((r) => r.listingId === id && !s.hiddenReviewIds.includes(r.id)),
    [s.reviews, s.hiddenReviewIds, id],
  );
  const similar = useMemo(
    () =>
      listing
        ? s.listings.filter((l) => l.categorySlug === listing.categorySlug && l.id !== listing.id && l.status === "active").slice(0, 3)
        : [],
    [s.listings, listing],
  );

  if (!listing || !seller) {
    return (
      <EmptyState
        icon={<SearchX className="h-7 w-7" aria-hidden />}
        title="Объявление не найдено"
        text="Возможно, оно было удалено или ссылка введена неверно."
        action={{ href: "/catalog", label: "В каталог" }}
      />
    );
  }

  const cat = categories.find((c) => c.slug === listing.categorySlug);
  const isOwner = user?.id === listing.sellerId;
  const unavailable = listing.status !== "active" || seller.blocked;
  const fee = calcFee(listing.priceUzs);
  const avg = averageRating(reviews.map((r) => r.rating));
  const hues = [0, 35, -35, 70].map((d) => ((cat?.hue ?? 250) + d + 360) % 360);

  function buy() {
    if (!listing) return;
    setBusy(true);
    const r = createOrder(listing.id);
    setBusy(false);
    if (r.ok) {
      toast.success(`Заказ ${r.data.number} создан. Осталось тестово оплатить.`);
      router.push(`/orders?id=${r.data.id}`);
    } else {
      toast.error(r.error);
    }
  }

  return (
    <div className="space-y-12">
      <nav aria-label="Навигация" className="text-sm text-muted">
        <Link href="/catalog" className="hover:text-ink">Каталог</Link>
        <span className="mx-2">/</span>
        <Link href={`/catalog?category=${listing.categorySlug}`} className="hover:text-ink">{cat?.name}</Link>
      </nav>

      <div className="grid gap-8 lg:grid-cols-[1fr_24rem]">
        <div className="space-y-8">
          {/* Галерея */}
          <div>
            <ListingImage slug={listing.categorySlug} hue={hues[imgIdx]} className="aspect-[16/9] w-full rounded-2xl border border-line" label={`${listing.title} — изображение ${imgIdx + 1}`} />
            <div className="mt-3 grid grid-cols-4 gap-3">
              {hues.map((h, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setImgIdx(i)}
                  aria-label={`Показать изображение ${i + 1}`}
                  aria-pressed={imgIdx === i}
                  className={`overflow-hidden rounded-xl border-2 transition ${imgIdx === i ? "border-accent" : "border-transparent opacity-70 hover:opacity-100"}`}
                >
                  <ListingImage slug={listing.categorySlug} hue={h} className="aspect-[16/10] w-full" />
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="accent">{cat?.name}</Badge>
              {listing.isDemo && <DemoBadge label="Тестовое объявление" />}
              {listing.status === "paused" && <Badge tone="warn">Приостановлено</Badge>}
              {listing.status === "blocked" && <Badge tone="danger">Заблокировано</Badge>}
            </div>
            <h1 className="mt-3 font-display text-2xl font-bold leading-tight sm:text-3xl">{listing.title}</h1>
            <p className="mt-4 whitespace-pre-line text-[15px] leading-relaxed text-ink/90">{listing.description}</p>
          </div>

          {/* Условия */}
          <section className="grid gap-4 sm:grid-cols-2" aria-label="Условия заказа">
            <div className="card p-5">
              <div className="flex items-center gap-2 font-semibold"><PackageCheck className="h-5 w-5 text-accent" aria-hidden /> Условия выполнения</div>
              <p className="mt-2 text-sm text-muted">{listing.fulfillmentTerms}</p>
              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex items-center gap-2"><Truck className="h-4 w-4 text-muted" aria-hidden /><dt className="sr-only">Способ передачи</dt><dd>{DELIVERY_LABELS[listing.deliveryMethod]}</dd></div>
                <div className="flex items-center gap-2"><Clock className="h-4 w-4 text-muted" aria-hidden /><dt className="sr-only">Срок</dt><dd>{listing.deliveryDays === 0 ? "Обычно сразу после оплаты" : `Примерный срок: до ${listing.deliveryDays} дн.`}</dd></div>
              </dl>
            </div>
            <div className="card p-5">
              <div className="flex items-center gap-2 font-semibold"><RotateCcw className="h-5 w-5 text-accent" aria-hidden /> Условия возврата</div>
              <p className="mt-2 text-sm text-muted">{listing.refundTerms}</p>
              <p className="mt-3 text-xs text-muted">Площадка не обещает автоматический возврат: спорные случаи рассматриваются администратором.</p>
            </div>
          </section>

          {/* Отзывы */}
          <section aria-labelledby="reviews">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <h2 id="reviews" className="font-display text-xl font-bold">Отзывы</h2>
              {reviews.length > 0 && (
                <span className="flex items-center gap-2 text-sm text-muted">
                  <Stars value={avg} /> <b className="text-ink">{avg.toFixed(1)}</b> · {reviews.length}
                </span>
              )}
            </div>
            {reviews.length === 0 ? (
              <p className="card p-5 text-sm text-muted">Отзывов пока нет. Оставить отзыв может покупатель после завершения заказа.</p>
            ) : (
              <ul className="space-y-3">
                {reviews.map((r) => (
                  <li key={r.id} className="card p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{r.authorName}</span>
                        {r.isDemo && <DemoBadge label="Тестовый отзыв" />}
                      </div>
                      <span className="text-xs text-muted">{formatDate(r.createdAt)}</span>
                    </div>
                    <div className="mt-1.5"><Stars value={r.rating} /></div>
                    <p className="mt-2 text-sm text-ink/90">{r.text}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* Боковая панель покупки */}
        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="card p-5">
            <p className="text-sm text-muted">Цена</p>
            <p className="font-display text-3xl font-extrabold">{formatUZS(listing.priceUzs)}</p>
            <p className="mt-1 text-xs text-muted">Комиссия площадки (демо, {FEE_PERCENT}%): {formatUZS(fee)} — удерживается с продавца.</p>

            <div className="mt-5 space-y-2.5">
              {unavailable ? (
                <Notice tone="warn">Сейчас это объявление недоступно для заказа.</Notice>
              ) : isOwner ? (
                <>
                  <Notice>Это ваше объявление.</Notice>
                  <Link href={`/seller/edit?id=${listing.id}`} className="btn-ghost w-full"><Pencil className="h-4 w-4" aria-hidden /> Редактировать</Link>
                </>
              ) : !ready ? (
                <button className="btn-primary w-full" disabled>Загрузка…</button>
              ) : !user ? (
                <>
                  <Notice>Чтобы создать заказ, войдите или зарегистрируйтесь.</Notice>
                  <Link href={`/login?next=${encodeURIComponent(`/listing?id=${listing.id}`)}`} className="btn-primary w-full"><ShoppingCart className="h-4 w-4" aria-hidden /> Войти и купить</Link>
                  <Link href="/register" className="btn-ghost w-full">Регистрация</Link>
                </>
              ) : (
                <button type="button" onClick={buy} disabled={busy} className="btn-primary w-full !py-3">
                  <ShoppingCart className="h-4 w-4" aria-hidden /> Купить
                </button>
              )}
              {!isOwner && <FavoriteButton listingId={listing.id} variant="full" />}
            </div>

            <p className="mt-4 flex gap-2 rounded-lg bg-warn/10 p-3 text-xs text-warn">
              <ShieldAlert className="h-4 w-4 shrink-0" aria-hidden />
              <span>DEMO — реальные деньги не переводятся. Оплата заказа тестовая.</span>
            </p>
            {!isOwner && (
              <Link
                href={`/support/new?kind=complaint&subject=${encodeURIComponent(`Жалоба на объявление: ${listing.title}`.slice(0, 120))}`}
                className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted hover:text-danger"
              >
                <Flag className="h-3.5 w-3.5" aria-hidden /> Пожаловаться на объявление
              </Link>
            )}
          </div>

          <div className="card p-5">
            <p className="mb-3 text-sm font-semibold">Продавец</p>
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-accent to-accent-2 font-display text-lg font-bold text-white">
                {seller.username.slice(0, 1).toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 font-semibold">
                  <span className="truncate">{seller.username}</span>
                  {seller.verified && <BadgeCheck className="h-4 w-4 shrink-0 text-accent-2" aria-label="Проверенный продавец" />}
                </p>
                {seller.isDemo && <DemoBadge label="Тестовый профиль" />}
              </div>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-muted">Рейтинг</dt>
                <dd className="flex items-center gap-1.5 font-semibold">{seller.reviewsCount ? <><Stars value={seller.rating} size="h-3.5 w-3.5" /> {seller.rating.toFixed(1)}</> : "—"}</dd>
              </div>
              <div>
                <dt className="text-muted">Отзывов</dt>
                <dd className="font-semibold">{seller.reviewsCount}</dd>
              </div>
              <div>
                <dt className="text-muted">Продаж</dt>
                <dd className="font-semibold">{seller.salesCount}</dd>
              </div>
              <div>
                <dt className="text-muted">На площадке с</dt>
                <dd className="flex items-center gap-1 font-semibold"><CalendarDays className="h-3.5 w-3.5 text-muted" aria-hidden />{formatDate(seller.createdAt)}</dd>
              </div>
            </dl>
            {seller.about && <p className="mt-4 text-sm text-muted">{seller.about}</p>}
          </div>
        </aside>
      </div>

      {similar.length > 0 && (
        <section aria-labelledby="similar">
          <h2 id="similar" className="mb-5 font-display text-xl font-bold">Похожие товары</h2>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {similar.map((l) => (
              <ListingCard key={l.id} listing={l} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/** Читает id из адреса (?id=...): так работает и статическая публикация. */
export function ListingPageClient() {
  const id = useSearchParams().get("id") ?? "";
  return <ListingClient id={id} />;
}
