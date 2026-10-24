"use client";

import { BarChart3 } from "lucide-react";
import { RequireAuth } from "@/components/require-auth";
import { EmptyState, PageHeader } from "@/components/ui";
import { formatUZS } from "@/lib/money";
import { STATUS_LABELS } from "@/lib/orders-domain";
import { useDemoState } from "@/lib/store";
import type { OrderStatus } from "@/lib/types";

export default function SellerStatsPage() {
  const s = useDemoState();
  return (
    <RequireAuth>
      {(user) => {
        const orders = s.orders.filter((o) => o.sellerId === user.id);
        const completed = orders.filter((o) => o.status === "completed");
        const gross = completed.reduce((sum, o) => sum + o.priceUzs, 0);
        const fees = completed.reduce((sum, o) => sum + o.feeUzs, 0);
        const net = gross - fees;
        const open = orders.filter((o) => ["paid", "in_progress", "delivered"].includes(o.status)).length;
        const disputed = orders.filter((o) => o.status === "disputed").length;
        const byStatus = (Object.keys(STATUS_LABELS) as OrderStatus[])
          .map((k) => ({ k, n: orders.filter((o) => o.status === k).length }))
          .filter((x) => x.n > 0);
        const max = Math.max(1, ...byStatus.map((x) => x.n));
        const perListing = s.listings
          .filter((l) => l.sellerId === user.id)
          .map((l) => {
            const done = completed.filter((o) => o.listingId === l.id);
            return { l, count: done.length, sum: done.reduce((a, o) => a + o.priceUzs, 0) };
          })
          .sort((a, b) => b.sum - a.sum);

        return (
          <div className="space-y-6">
            <PageHeader title="Статистика продаж" subtitle="Суммы в демо-режиме условные — деньги не переводятся." />
            {orders.length === 0 ? (
              <EmptyState icon={<BarChart3 className="h-7 w-7" aria-hidden />} title="Данных для статистики пока нет" text="Статистика появится после первых заказов." />
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
                  {[
                    { label: "Завершённых продаж", value: String(completed.length) },
                    { label: "Выручка (условная)", value: formatUZS(gross) },
                    { label: "Комиссия (демо)", value: formatUZS(fees) },
                    { label: "К получению (условно)", value: formatUZS(net) },
                  ].map((c) => (
                    <div key={c.label} className="card p-4">
                      <p className="text-xs text-muted">{c.label}</p>
                      <p className="mt-1 font-display text-xl font-bold sm:text-2xl">{c.value}</p>
                    </div>
                  ))}
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                  <section className="card p-5" aria-labelledby="by-status">
                    <h2 id="by-status" className="mb-4 font-semibold">Заказы по статусам</h2>
                    <ul className="space-y-3">
                      {byStatus.map((x) => (
                        <li key={x.k}>
                          <div className="mb-1 flex justify-between text-sm"><span>{STATUS_LABELS[x.k]}</span><b>{x.n}</b></div>
                          <div className="h-2 overflow-hidden rounded-full bg-panel-2" role="presentation">
                            <div className="h-full rounded-full bg-gradient-to-r from-accent to-accent-2" style={{ width: `${(x.n / max) * 100}%` }} />
                          </div>
                        </li>
                      ))}
                    </ul>
                    <p className="mt-4 text-xs text-muted">В работе: {open} · Споры: {disputed}</p>
                  </section>

                  <section className="card p-5" aria-labelledby="by-listing">
                    <h2 id="by-listing" className="mb-4 font-semibold">По объявлениям</h2>
                    {perListing.length === 0 ? (
                      <p className="text-sm text-muted">У вас нет объявлений.</p>
                    ) : (
                      <ul className="divide-y divide-line">
                        {perListing.map(({ l, count, sum }) => (
                          <li key={l.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                            <span className="min-w-0 truncate">{l.title}</span>
                            <span className="shrink-0 text-right"><b>{formatUZS(sum)}</b><span className="block text-xs text-muted">{count} продаж</span></span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                </div>
              </>
            )}
          </div>
        );
      }}
    </RequireAuth>
  );
}
