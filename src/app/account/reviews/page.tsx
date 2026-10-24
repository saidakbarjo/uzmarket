"use client";

import Link from "next/link";
import { MessageSquareText } from "lucide-react";
import { RequireAuth } from "@/components/require-auth";
import { ReviewForm } from "@/components/review-form";
import { DemoBadge, EmptyState, PageHeader, Stars, formatDate } from "@/components/ui";
import { useDemoState } from "@/lib/store";

export default function ReviewsPage() {
  const s = useDemoState();
  return (
    <RequireAuth>
      {(user) => {
        const awaiting = s.orders.filter((o) => o.buyerId === user.id && o.status === "completed" && !s.reviews.some((r) => r.orderId === o.id));
        const written = s.reviews.filter((r) => r.authorId === user.id);
        const received = s.reviews.filter((r) => r.sellerId === user.id && !s.hiddenReviewIds.includes(r.id));
        return (
          <div className="space-y-10">
            <PageHeader title="Отзывы" subtitle="Оставить отзыв можно только после завершённого заказа." />

            <section aria-labelledby="awaiting" className="space-y-3">
              <h2 id="awaiting" className="font-semibold">Ждут вашего отзыва</h2>
              {awaiting.length === 0 ? (
                <p className="card p-5 text-sm text-muted">Нет завершённых заказов без отзыва.</p>
              ) : (
                awaiting.map((o) => (
                  <div key={o.id} className="card p-5">
                    <p className="mb-3 text-sm"><span className="font-mono font-semibold">{o.number}</span> · {o.listingTitle}</p>
                    <ReviewForm orderId={o.id} />
                  </div>
                ))
              )}
            </section>

            <section aria-labelledby="written" className="space-y-3">
              <h2 id="written" className="font-semibold">Мои отзывы</h2>
              {written.length === 0 ? (
                <EmptyState icon={<MessageSquareText className="h-7 w-7" aria-hidden />} title="Вы пока не оставляли отзывов" text="После завершения заказа здесь появится форма отзыва." />
              ) : (
                <ul className="space-y-3">
                  {written.map((r) => (
                    <li key={r.id} className="card p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Link href={`/listing?id=${r.listingId}`} className="text-sm font-medium text-accent hover:underline">{s.listings.find((l) => l.id === r.listingId)?.title ?? "Объявление"}</Link>
                        <span className="text-xs text-muted">{formatDate(r.createdAt)}</span>
                      </div>
                      <div className="mt-1"><Stars value={r.rating} /></div>
                      <p className="mt-2 text-sm">{r.text}</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section aria-labelledby="received" className="space-y-3">
              <h2 id="received" className="font-semibold">Отзывы о моих товарах</h2>
              {received.length === 0 ? (
                <p className="card p-5 text-sm text-muted">Отзывов о ваших товарах пока нет.</p>
              ) : (
                <ul className="space-y-3">
                  {received.map((r) => (
                    <li key={r.id} className="card p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="flex items-center gap-2 text-sm font-medium">{r.authorName}{r.isDemo && <DemoBadge label="Тестовый отзыв" />}</span>
                        <span className="text-xs text-muted">{formatDate(r.createdAt)}</span>
                      </div>
                      <div className="mt-1"><Stars value={r.rating} /></div>
                      <p className="mt-2 text-sm">{r.text}</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        );
      }}
    </RequireAuth>
  );
}
