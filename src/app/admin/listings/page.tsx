"use client";

import Link from "next/link";
import { Ban, Check, ShieldCheck, X } from "lucide-react";
import { useState } from "react";
import { DataTable, type Column } from "@/components/data-table";
import { Badge, ConfirmButton, DemoBadge, PageHeader } from "@/components/ui";
import { formatUZS } from "@/lib/money";
import { moderateListing, setListingStatus, useDemoState } from "@/lib/store";
import { toast } from "@/lib/toast";
import type { Listing, ListingStatus } from "@/lib/types";

const STATUS: Record<ListingStatus, { label: string; tone: "ok" | "warn" | "danger" }> = {
  pending: { label: "На модерации", tone: "warn" },
  rejected: { label: "Отклонено", tone: "danger" },
  active: { label: "Активно", tone: "ok" },
  paused: { label: "Приостановлено", tone: "warn" },
  blocked: { label: "Заблокировано", tone: "danger" },
};

export default function AdminListingsPage() {
  const s = useDemoState();
  const [status, setStatus] = useState<ListingStatus | "">("");
  const [game, setGame] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const rows = s.listings.filter((l) => (!status || l.status === status) && (!game || l.gameSlug === game));

  const columns: Column<Listing>[] = [
    { key: "title", header: "Объявление", render: (l) => <Link href={`/listing?id=${l.id}`} className="font-medium hover:text-accent">{l.title}{l.isDemo && <span className="ml-2 align-middle"><DemoBadge /></span>}</Link> },
    { key: "seller", header: "Продавец", render: (l) => s.profiles.find((p) => p.id === l.sellerId)?.username ?? "—" },
    { key: "cat", header: "Игра", render: (l) => s.games.find((g) => g.slug === l.gameSlug)?.name },
    { key: "price", header: "Цена", render: (l) => <span className="whitespace-nowrap">{formatUZS(l.priceUzs)}</span> },
    { key: "status", header: "Статус", render: (l) => <Badge tone={STATUS[l.status].tone}>{STATUS[l.status].label}</Badge> },
    {
      key: "actions",
      header: "Действия",
      render: (l) =>
        l.status === "pending" ? (
          <div className="space-y-2">
            <input className="input !py-1.5 text-xs" placeholder="Причина отказа" aria-label={`Причина отказа: ${l.title}`} value={notes[l.id] ?? ""} onChange={(e) => setNotes((n) => ({ ...n, [l.id]: e.target.value }))} maxLength={300} />
            <div className="flex gap-1.5">
              <button type="button" className="btn-primary !px-3 !py-1.5 !text-xs" onClick={() => { const r = moderateListing(l.id, "approve"); if (r.ok) toast.success("Объявление одобрено"); else toast.error(r.error); }}><Check className="h-3.5 w-3.5" aria-hidden /> Одобрить</button>
              <button type="button" className="btn-danger !px-3 !py-1.5 !text-xs" onClick={() => { const r = moderateListing(l.id, "reject", notes[l.id] ?? ""); if (r.ok) toast.success("Объявление отклонено"); else toast.error(r.error); }}><X className="h-3.5 w-3.5" aria-hidden /> Отклонить</button>
            </div>
          </div>
        ) : l.status === "blocked" || l.status === "rejected" ? (
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
      <PageHeader title="Объявления и модерация" subtitle="Новые и изменённые объявления попадают сюда, если включена модерация (Настройки)." />
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
              <option value="pending">На модерации</option>
              <option value="rejected">Отклонённые</option>
            </select>
            <select className="input !w-auto" value={game} onChange={(e) => setGame(e.target.value)} aria-label="Фильтр по игре">
              <option value="">Все игры</option>
              {s.games.map((g) => <option key={g.slug} value={g.slug}>{g.name}</option>)}
            </select>
          </>
        }
      />
    </div>
  );
}
