"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useMemo } from "react";
import { OrderStatusBadge, PageHeader, TicketStatusBadge, formatDate } from "@/components/ui";
import { FOUNDER_USERNAME } from "@/lib/data/seed";
import { formatUZS } from "@/lib/money";
import { platformStats } from "@/lib/stats";
import { useDemoState } from "@/lib/store";

export default function AdminOverviewPage() {
  const s = useDemoState();
  const st = useMemo(() => platformStats(s.orders, s.ledger, s.games, new Date()), [s.orders, s.ledger, s.games]);
  const openTickets = s.tickets.filter((t) => ["open", "in_review", "need_info"].includes(t.status));
  const name = (id: string) => s.profiles.find((p) => p.id === id)?.username ?? "—";
  const maxFee = Math.max(1, ...st.byGame.map((g) => g.feeUzs));

  const cards = [
    { label: "Оборот (тест)", value: formatUZS(st.turnoverUzs), href: "/admin/orders" },
    { label: "Всего заказов", value: st.ordersCount, href: "/admin/orders" },
    { label: "Завершено сделок", value: st.completedCount, href: "/admin/orders" },
    { label: "Комиссия за всё время", value: formatUZS(st.commissionAll), href: "/admin/finance" },
    { label: "Комиссия за день", value: formatUZS(st.commissionDay), href: "/admin/finance" },
    { label: "Комиссия за неделю", value: formatUZS(st.commissionWeek), href: "/admin/finance" },
    { label: "Комиссия за месяц", value: formatUZS(st.commissionMonth), href: "/admin/finance" },
    { label: "Споры и возвраты", value: st.disputedCount, href: "/admin/disputes" },
    { label: "Заявок на вывод в работе", value: s.payouts.filter((p) => ["created", "in_review", "approved"].includes(p.status)).length, href: "/admin/payouts" },
    { label: "На модерации", value: s.listings.filter((l) => l.status === "pending").length, href: "/admin/listings" },
    { label: "Пользователей", value: s.profiles.length, href: "/admin/users" },
    { label: "Активных объявлений", value: s.listings.filter((l) => l.status === "active").length, href: "/admin/listings" },
  ];

  return (
    <div className="space-y-8">
      <PageHeader title="Обзор" subtitle={`Основатель и руководитель: ${FOUNDER_USERNAME}. Все суммы тестовые — деньги не переводятся.`} />
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4" data-testid="admin-stats">
        {cards.map((c) => (
          <Link key={c.label} href={c.href} className="card card-hover p-4">
            <p className="text-xs text-muted">{c.label}</p>
            <p className="mt-1 whitespace-nowrap font-display text-base font-bold sm:text-lg xl:text-xl">{c.value}</p>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="card p-5" aria-labelledby="by-game">
          <h2 id="by-game" className="mb-4 font-semibold">Комиссия по играм (завершённые заказы)</h2>
          <ul className="space-y-3">
            {st.byGame.map((g) => (
              <li key={g.slug}>
                <div className="mb-1 flex justify-between gap-3 text-sm"><span className="truncate">{g.name}</span><b className="whitespace-nowrap">{formatUZS(g.feeUzs)}</b></div>
                <div className="h-2 overflow-hidden rounded-full bg-panel-2" role="presentation"><div className="h-full rounded-full bg-gradient-to-r from-accent to-accent-2" style={{ width: `${(g.feeUzs / maxFee) * 100}%` }} /></div>
                <p className="mt-0.5 text-xs text-muted">{g.orders} сделок · оборот {formatUZS(g.turnoverUzs)}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="card p-5" aria-labelledby="by-seller">
          <h2 id="by-seller" className="mb-4 font-semibold">Продавцы: продажи и доходы</h2>
          {st.bySeller.length === 0 ? (
            <p className="text-sm text-muted">Завершённых сделок пока нет.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs text-muted"><th className="pb-2 pr-3">Продавец</th><th className="pb-2 pr-3">Сделок</th><th className="pb-2 pr-3">Продажи</th><th className="pb-2 pr-3">Комиссия</th><th className="pb-2">Доход</th></tr></thead>
                <tbody className="divide-y divide-line">
                  {st.bySeller.map((x) => (
                    <tr key={x.sellerId}><td className="py-2 pr-3 font-medium">{name(x.sellerId)}</td><td className="pr-3">{x.orders}</td><td className="whitespace-nowrap pr-3">{formatUZS(x.grossUzs)}</td><td className="whitespace-nowrap pr-3">{formatUZS(x.feeUzs)}</td><td className="whitespace-nowrap">{formatUZS(x.netUzs)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="card p-5" aria-labelledby="last-orders">
          <div className="mb-3 flex items-center justify-between">
            <h2 id="last-orders" className="font-semibold">Последние заказы</h2>
            <Link href="/admin/orders" className="flex items-center gap-1 text-xs text-accent hover:underline">Все <ArrowRight className="h-3 w-3" aria-hidden /></Link>
          </div>
          <ul className="divide-y divide-line">
            {[...s.orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5).map((o) => (
              <li key={o.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <Link href={`/orders?id=${o.id}`} className="min-w-0 truncate hover:text-accent"><span className="font-mono text-xs text-muted">{o.number}</span> {o.listingTitle}</Link>
                <OrderStatusBadge status={o.status} />
              </li>
            ))}
          </ul>
        </section>

        <section className="card p-5" aria-labelledby="last-tickets">
          <div className="mb-3 flex items-center justify-between">
            <h2 id="last-tickets" className="font-semibold">Обращения, требующие внимания</h2>
            <Link href="/admin/disputes" className="flex items-center gap-1 text-xs text-accent hover:underline">Споры <ArrowRight className="h-3 w-3" aria-hidden /></Link>
          </div>
          {openTickets.length === 0 ? (
            <p className="text-sm text-muted">Открытых обращений нет.</p>
          ) : (
            <ul className="divide-y divide-line">
              {openTickets.slice(0, 5).map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <Link href={`/support/ticket?id=${t.id}`} className="min-w-0 truncate hover:text-accent"><span className="font-mono text-xs text-muted">{t.number}</span> {t.subject}<span className="block text-xs text-muted">{formatDate(t.createdAt)}</span></Link>
                  <TicketStatusBadge status={t.status} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
