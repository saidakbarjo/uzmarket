"use client";

import { BadgeCheck } from "lucide-react";
import { DataTable, type Column } from "@/components/data-table";
import { Badge, DemoBadge, PageHeader, Stars } from "@/components/ui";
import { setSellerVerified, useDemoState } from "@/lib/store";
import { toast } from "@/lib/toast";
import type { Profile } from "@/lib/types";

export default function AdminSellersPage() {
  const s = useDemoState();
  const sellers = s.profiles.filter((p) => p.isSeller);

  const columns: Column<Profile>[] = [
    { key: "name", header: "Продавец", render: (p) => <span className="flex flex-wrap items-center gap-2 font-medium">{p.username}{p.verified && <BadgeCheck className="h-4 w-4 text-accent-2" aria-label="Проверен" />}{p.isDemo && <DemoBadge />}</span> },
    { key: "rating", header: "Рейтинг", render: (p) => (p.reviewsCount ? <span className="inline-flex items-center gap-1.5"><Stars value={p.rating} size="h-3 w-3" /> {p.rating.toFixed(1)}</span> : "—") },
    { key: "reviews", header: "Отзывов", render: (p) => p.reviewsCount },
    { key: "sales", header: "Продаж", render: (p) => p.salesCount },
    { key: "listings", header: "Объявлений", render: (p) => s.listings.filter((l) => l.sellerId === p.id).length },
    { key: "state", header: "Статус", render: (p) => (p.blocked ? <Badge tone="danger">Заблокирован</Badge> : p.verified ? <Badge tone="ok">Проверен</Badge> : <Badge>Обычный</Badge>) },
    {
      key: "actions",
      header: "Действия",
      render: (p) => (
        <button
          type="button"
          className="btn-ghost !px-3 !py-1.5 !text-xs"
          onClick={() => {
            const r = setSellerVerified(p.id, !p.verified);
            if (r.ok) toast.success(p.verified ? "Отметка «Проверен» снята" : "Продавец отмечен как проверенный");
            else toast.error(r.error);
          }}
        >
          {p.verified ? "Снять отметку" : "Отметить проверенным"}
        </button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="Продавцы" subtitle="Отметка «Проверен» в демо-режиме условная." />
      <DataTable rows={sellers} columns={columns} rowKey={(p) => p.id} searchText={(p) => p.username} searchPlaceholder="Поиск по имени" />
    </div>
  );
}
