"use client";

import { Eye, EyeOff } from "lucide-react";
import { DataTable, type Column } from "@/components/data-table";
import { Badge, ConfirmButton, DemoBadge, PageHeader, Stars, formatDate } from "@/components/ui";
import { setReviewHidden, useDemoState } from "@/lib/store";
import { toast } from "@/lib/toast";
import type { Review } from "@/lib/types";

export default function AdminReviewsPage() {
  const s = useDemoState();
  const rows = [...s.reviews].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const columns: Column<Review>[] = [
    { key: "author", header: "Автор", render: (r) => <span className="flex flex-wrap items-center gap-2">{r.authorName}{r.isDemo && <DemoBadge />}</span> },
    { key: "rating", header: "Оценка", render: (r) => <Stars value={r.rating} size="h-3.5 w-3.5" /> },
    { key: "text", header: "Отзыв", render: (r) => <span className="line-clamp-2 text-left">{r.text}</span> },
    { key: "listing", header: "Объявление", render: (r) => <span className="line-clamp-1">{s.listings.find((l) => l.id === r.listingId)?.title ?? "Удалено"}</span> },
    { key: "date", header: "Дата", render: (r) => formatDate(r.createdAt) },
    { key: "state", header: "Статус", render: (r) => (s.hiddenReviewIds.includes(r.id) ? <Badge tone="warn">Скрыт</Badge> : <Badge tone="ok">Виден</Badge>) },
    {
      key: "actions",
      header: "Действия",
      render: (r) =>
        s.hiddenReviewIds.includes(r.id) ? (
          <button
            type="button"
            className="btn-ghost !px-3 !py-1.5 !text-xs"
            onClick={() => {
              const res = setReviewHidden(r.id, false);
              if (res.ok) toast.success("Отзыв снова виден");
              else toast.error(res.error);
            }}
          >
            <Eye className="h-3.5 w-3.5" aria-hidden /> Показать
          </button>
        ) : (
          <ConfirmButton
            label="Скрыть"
            className="btn-danger !px-3 !py-1.5 !text-xs"
            icon={<EyeOff className="h-3.5 w-3.5" aria-hidden />}
            title="Скрыть отзыв?"
            description="Отзыв перестанет отображаться на странице товара. Его можно вернуть позже."
            confirmLabel="Скрыть"
            onConfirm={() => {
              const res = setReviewHidden(r.id, true);
              if (res.ok) toast.success("Отзыв скрыт");
              else toast.error(res.error);
            }}
          />
        ),
    },
  ];

  return (
    <div>
      <PageHeader title="Отзывы" subtitle="Модерация отзывов." />
      <DataTable rows={rows} columns={columns} rowKey={(r) => r.id} searchText={(r) => `${r.authorName} ${r.text}`} searchPlaceholder="Автор или текст" />
    </div>
  );
}
