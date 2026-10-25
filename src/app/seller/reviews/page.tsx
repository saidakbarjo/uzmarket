"use client";

import { useState } from "react";
import { EmptyState, PageHeader, Stars, formatDate } from "@/components/ui";
import { replyToReview, useCurrentUser, useDemoState } from "@/lib/store";
import { toast } from "@/lib/toast";
import type { Review } from "@/lib/types";

function ReplyForm({ r }: { r: Review }) {
  const [text, setText] = useState("");
  return (
    <form
      className="mt-3 flex flex-col gap-2 sm:flex-row"
      onSubmit={(e) => {
        e.preventDefault();
        const res = replyToReview(r.id, text);
        if (res.ok) {
          setText("");
          toast.success("Ответ опубликован");
        } else toast.error(res.error);
      }}
    >
      <input className="input" aria-label="Ответ на отзыв" placeholder="Ответить покупателю…" value={text} onChange={(e) => setText(e.target.value)} maxLength={500} />
      <button type="submit" className="btn-primary shrink-0" disabled={!text.trim()}>Ответить</button>
    </form>
  );
}

export default function SellerReviewsPage() {
  const s = useDemoState();
  const { user } = useCurrentUser();
  if (!user) return null;
  const mine = s.reviews.filter((r) => r.sellerId === user.id && !s.hiddenReviewIds.includes(r.id)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return (
    <div>
      <PageHeader title="Отзывы о моих товарах" subtitle={user.reviewsCount ? `Рейтинг ${user.rating.toFixed(1)} · отзывов: ${user.reviewsCount}` : "Отзывов пока нет"} />
      {mine.length === 0 ? (
        <EmptyState title="Отзывов пока нет" text="Они появятся после завершённых заказов." />
      ) : (
        <ul className="space-y-3">
          {mine.map((r) => {
            const l = s.listings.find((x) => x.id === r.listingId);
            return (
              <li key={r.id} className="card p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm"><span className="font-medium">{r.authorName}</span><span className="text-xs text-muted">{formatDate(r.createdAt)}</span></div>
                <p className="text-xs text-muted">{l?.title ?? "Объявление удалено"}</p>
                <div className="mt-1"><Stars value={r.rating} /></div>
                <p className="mt-2 text-sm">{r.text}</p>
                {r.sellerReply ? (
                  <div className="mt-3 rounded-lg border-l-2 border-accent bg-panel-2 p-3 text-sm"><p className="text-xs font-semibold text-accent">Ваш ответ · {formatDate(r.sellerReply.at)}</p><p className="mt-1">{r.sellerReply.text}</p></div>
                ) : (
                  <ReplyForm r={r} />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
