"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { OrderStatusBadge, PageHeader, TicketStatusBadge, formatDate } from "@/components/ui";
import { FOUNDER_USERNAME } from "@/lib/data/seed";
import { formatUZS } from "@/lib/money";
import { useDemoState } from "@/lib/store";

export default function AdminOverviewPage() {
  const s = useDemoState();
  const completed = s.orders.filter((o) => o.status === "completed");
  const volume = completed.reduce((a, o) => a + o.priceUzs, 0);
  const fees = completed.reduce((a, o) => a + o.feeUzs, 0);
  const openTickets = s.tickets.filter((t) => ["open", "in_review"].includes(t.status));

  const cards = [
    { label: "Пользователей", value: s.profiles.length, href: "/admin/users" },
    { label: "Активных объявлений", value: s.listings.filter((l) => l.status === "active").length, href: "/admin/listings" },
    { label: "Заказов", value: s.orders.length, href: "/admin/orders" },
    { label: "Открытых обращений", value: openTickets.length, href: "/admin/disputes" },
    { label: "Оборот (условный)", value: formatUZS(volume), href: "/admin/orders" },
    { label: "Комиссия (демо)", value: formatUZS(fees), href: "/admin/orders" },
  ];

  return (
    <div className="space-y-8">
      <PageHeader title="Обзор" subtitle={`Основатель и руководитель: ${FOUNDER_USERNAME}. Все суммы условные — деньги не переводятся.`} />
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-3">
        {cards.map((c) => (
          <Link key={c.label} href={c.href} className="card card-hover p-4">
            <p className="text-xs text-muted">{c.label}</p>
            <p className="mt-1 break-words font-display text-xl font-bold sm:text-2xl">{c.value}</p>
          </Link>
        ))}
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
