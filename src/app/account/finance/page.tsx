"use client";

import Link from "next/link";
import { RequireAuth } from "@/components/require-auth";
import { EmptyState, Notice, OrderStatusBadge, PageHeader, formatDate } from "@/components/ui";
import { formatUZS } from "@/lib/money";
import { useDemoState } from "@/lib/store";

export default function AccountFinancePage() {
  const s = useDemoState();
  return (
    <RequireAuth>
      {(user) => {
        const paid = s.orders.filter((o) => o.buyerId === user.id && o.status !== "pending_payment" && o.status !== "cancelled" || (o.buyerId === user.id && s.intents.some((i) => i.orderId === o.id)));
        const rows = [...new Map(paid.map((o) => [o.id, o])).values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        const spent = rows.filter((o) => ["paid", "in_progress", "delivered", "completed", "disputed", "refund_review"].includes(o.status)).reduce((a, o) => a + o.commission.totalUzs, 0);
        return (
          <div className="space-y-6">
            <PageHeader title="Финансы" subtitle="История ваших (тестовых) платежей по заказам." />
            <Notice tone="warn">DEMO: платежи тестовые, реальные деньги не списываются. Настоящий платёжный модуль будет подключён отдельно.</Notice>
            <div className="card p-5"><p className="text-xs text-muted">Потрачено в заказах, ожидающих или завершённых (тест)</p><p className="font-display text-2xl font-bold">{formatUZS(spent)}</p></div>
            {user.isSeller && <Link href="/seller/finance" className="btn-ghost">Баланс и выплаты продавца</Link>}
            {rows.length === 0 ? (
              <EmptyState title="Операций пока нет" text="Они появятся после первой тестовой оплаты." action={{ href: "/catalog", label: "В каталог" }} />
            ) : (
              <ul className="space-y-3">
                {rows.map((o) => (
                  <li key={o.id}>
                    <Link href={`/orders?id=${o.id}`} className="card card-hover flex flex-wrap items-center justify-between gap-3 p-4">
                      <span className="min-w-0"><span className="font-mono text-xs text-muted">{o.number} · {formatDate(o.createdAt)}</span><span className="block truncate font-medium">{o.listingTitle}</span></span>
                      <span className="flex items-center gap-3"><b>{formatUZS(o.commission.totalUzs)}</b><OrderStatusBadge status={o.status} /></span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      }}
    </RequireAuth>
  );
}
