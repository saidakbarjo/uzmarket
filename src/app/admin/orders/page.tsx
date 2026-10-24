"use client";

import Link from "next/link";
import { useState } from "react";
import { DataTable, type Column } from "@/components/data-table";
import { OrderStatusBadge, PageHeader, formatDate } from "@/components/ui";
import { formatUZS } from "@/lib/money";
import { STATUS_LABELS } from "@/lib/orders-domain";
import { useDemoState } from "@/lib/store";
import type { Order, OrderStatus } from "@/lib/types";

export default function AdminOrdersPage() {
  const s = useDemoState();
  const [status, setStatus] = useState<OrderStatus | "">("");
  const name = (id: string) => s.profiles.find((p) => p.id === id)?.username ?? "—";
  const rows = [...s.orders].filter((o) => !status || o.status === status).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const columns: Column<Order>[] = [
    { key: "num", header: "Номер", render: (o) => <Link href={`/orders?id=${o.id}`} className="font-mono font-semibold text-accent hover:underline">{o.number}</Link> },
    { key: "title", header: "Товар", render: (o) => <span className="line-clamp-2">{o.listingTitle}</span> },
    { key: "buyer", header: "Покупатель", render: (o) => name(o.buyerId) },
    { key: "seller", header: "Продавец", render: (o) => name(o.sellerId) },
    { key: "price", header: "Сумма", render: (o) => <span className="whitespace-nowrap">{formatUZS(o.priceUzs)}</span> },
    { key: "status", header: "Статус", render: (o) => <OrderStatusBadge status={o.status} /> },
    { key: "date", header: "Создан", render: (o) => formatDate(o.createdAt) },
  ];

  return (
    <div>
      <PageHeader title="Заказы" subtitle="Откройте заказ, чтобы оформить тестовый возврат или решить спор." />
      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(o) => o.id}
        searchText={(o) => `${o.number} ${o.listingTitle} ${name(o.buyerId)} ${name(o.sellerId)}`}
        searchPlaceholder="Номер, товар или участник"
        toolbar={
          <select className="input !w-auto" value={status} onChange={(e) => setStatus(e.target.value as OrderStatus | "")} aria-label="Фильтр по статусу">
            <option value="">Все статусы</option>
            {(Object.keys(STATUS_LABELS) as OrderStatus[]).map((k) => <option key={k} value={k}>{STATUS_LABELS[k]}</option>)}
          </select>
        }
      />
    </div>
  );
}
