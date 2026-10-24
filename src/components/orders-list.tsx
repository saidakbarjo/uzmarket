"use client";

import Link from "next/link";
import { ArrowRight, ShoppingBag } from "lucide-react";
import { useState } from "react";
import { EmptyState, OrderStatusBadge, formatDate } from "@/components/ui";
import { formatUZS } from "@/lib/money";
import { STATUS_LABELS } from "@/lib/orders-domain";
import { useDemoState } from "@/lib/store";
import type { Order, OrderStatus } from "@/lib/types";

export function OrdersList({
  orders,
  userId,
  emptyTitle,
  emptyText,
  emptyAction,
  showFilter = true,
}: {
  orders: Order[];
  userId: string;
  emptyTitle: string;
  emptyText: string;
  emptyAction?: { href: string; label: string };
  showFilter?: boolean;
}) {
  const s = useDemoState();
  const [status, setStatus] = useState<OrderStatus | "">("");
  const shown = [...(status ? orders.filter((o) => o.status === status) : orders)].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  if (orders.length === 0) {
    return <EmptyState icon={<ShoppingBag className="h-7 w-7" aria-hidden />} title={emptyTitle} text={emptyText} action={emptyAction} />;
  }

  return (
    <div className="space-y-4">
      {showFilter && (
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="status-filter" className="text-sm text-muted">Статус:</label>
          <select id="status-filter" className="input !w-auto" value={status} onChange={(e) => setStatus(e.target.value as OrderStatus | "")}>
            <option value="">Все</option>
            {(Object.keys(STATUS_LABELS) as OrderStatus[]).map((k) => (
              <option key={k} value={k}>{STATUS_LABELS[k]}</option>
            ))}
          </select>
        </div>
      )}
      {shown.length === 0 ? (
        <p className="card p-6 text-sm text-muted">Нет заказов с таким статусом.</p>
      ) : (
        <ul className="space-y-3">
          {shown.map((o) => {
            const role = o.buyerId === userId ? "Покупка" : "Продажа";
            const counterpart = s.profiles.find((p) => p.id === (o.buyerId === userId ? o.sellerId : o.buyerId));
            return (
              <li key={o.id}>
                <Link href={`/orders/${o.id}`} className="card card-hover flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                      <span className="font-mono font-semibold text-ink">{o.number}</span>
                      <span>{role}</span>
                      <span>·</span>
                      <span>{formatDate(o.createdAt, true)}</span>
                      {o.isDemo && <span className="rounded bg-warn/10 px-1.5 py-0.5 font-semibold text-warn">ТЕСТ</span>}
                    </div>
                    <p className="mt-1 truncate font-medium">{o.listingTitle}</p>
                    <p className="text-xs text-muted">{o.buyerId === userId ? "Продавец" : "Покупатель"}: {counterpart?.username ?? "—"}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-4">
                    <span className="font-display font-bold">{formatUZS(o.priceUzs)}</span>
                    <OrderStatusBadge status={o.status} />
                    <ArrowRight className="hidden h-4 w-4 text-muted sm:block" aria-hidden />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
