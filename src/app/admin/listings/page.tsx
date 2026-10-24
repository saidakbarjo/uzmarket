"use client";

import Link from "next/link";
import { Ban, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { DataTable, type Column } from "@/components/data-table";
import { Badge, ConfirmButton, DemoBadge, PageHeader } from "@/components/ui";
import { categories } from "@/lib/data/seed";
import { formatUZS } from "@/lib/money";
import { setListingStatus, useDemoState } from "@/lib/store";
import { toast } from "@/lib/toast";
import type { Listing, ListingStatus } from "@/lib/types";

const STATUS: Record<ListingStatus, { label: string; tone: "ok" | "warn" | "danger" }> = {
  active: { label: "Активно", tone: "ok" },
  paused: { label: "Приостановлено", tone: "warn" },
  blocked: { label: "Заблокировано", tone: "danger" },
};

export default function AdminListingsPage() {
  const s = useDemoState();
  const [status, setStatus] = useState<ListingStatus | "">("");
  const [category, setCategory] = useState("");
  const rows = s.listings.filter((l) => (!status || l.status === status) && (!category || l.categorySlug === category));

  const columns: Column<Listing>[] = [
    { key: "title", header: "Объявление", render: (l) => <Link href={`/listing/${l.id}`} className="font-medium hover:text-accent">{l.title}{l.isDemo && <span className="ml-2 align-middle"><DemoBadge /></span>}</Link> },
    { key: "seller", header: "Продавец", render: (l) => s.profiles.find((p) => p.id === l.sellerId)?.username ?? "—" },
    { key: "cat", header: "Категория", render: (l) => categories.find((c) => c.slug === l.categorySlug)?.name },
    { key: "price", header: "Цена", render: (l) => <span className="whitespace-nowrap">{formatUZS(l.priceUzs)}</span> },
    { key: "status", header: "Статус", render: (l) => <Badge tone={STATUS[l.status].tone}>{STATUS[l.status].label}</Badge> },
    {
      key: "actions",
      header: "Действия",
      render: (l) =>
        l.status === "blocked" ? (
          <button
            type="button"
            className="btn-ghost !px-3 !py-1.5 !text-xs"
            onClick={() => {
              const r = setListingStatus(l.id, "active");
              if (r.ok) toast.success("Объявление разблокировано");
              else toast.error(r.error);
            }}
          >
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden /> Разблокировать
          </button>
        ) : (
          <ConfirmButton
            label="Заблокировать"
            className="btn-danger !px-3 !py-1.5 !text-xs"
            icon={<Ban className="h-3.5 w-3.5" aria-hidden />}
            title="Заблокировать объявление?"
            description="Объявление исчезнет из каталога, и продавец не сможет его возобновить. Блокировку может снять только администратор."
            confirmLabel="Заблокировать"
            onConfirm={() => {
              const r = setListingStatus(l.id, "blocked");
              if (r.ok) toast.success("Объявление заблокировано");
              else toast.error(r.error);
            }}
          />
        ),
    },
  ];

  return (
    <div>
      <PageHeader title="Объявления" />
      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(l) => l.id}
        searchText={(l) => l.title}
        searchPlaceholder="Поиск по названию"
        toolbar={
          <>
            <select className="input !w-auto" value={status} onChange={(e) => setStatus(e.target.value as ListingStatus | "")} aria-label="Фильтр по статусу">
              <option value="">Все статусы</option>
              <option value="active">Активные</option>
              <option value="paused">Приостановленные</option>
              <option value="blocked">Заблокированные</option>
            </select>
            <select className="input !w-auto" value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Фильтр по категории">
              <option value="">Все категории</option>
              {categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
            </select>
          </>
        }
      />
    </div>
  );
}
