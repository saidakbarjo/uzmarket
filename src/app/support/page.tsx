"use client";

import Link from "next/link";
import { LifeBuoy, Plus } from "lucide-react";
import { RequireAuth } from "@/components/require-auth";
import { EmptyState, Notice, PageHeader, TicketStatusBadge, formatDate } from "@/components/ui";
import { ticketsForUser, useDemoState } from "@/lib/store";
import type { TicketKind } from "@/lib/types";

const KIND: Record<TicketKind, string> = { support: "Вопрос", dispute: "Спор", complaint: "Жалоба" };

export default function SupportPage() {
  const s = useDemoState();

  return (
    <div>
      <PageHeader
        title="Поддержка"
        subtitle="Задайте вопрос, откройте спор по заказу или пожалуйтесь на объявление."
        actions={<Link href="/support/new" className="btn-primary"><Plus className="h-4 w-4" aria-hidden /> Новое обращение</Link>}
      />
      <Notice tone="warn" className="mb-6">
        Обращения в демо-режиме хранятся только в вашем браузере и не доходят до реальных сотрудников. Площадка не обещает автоматический возврат денег — решение по спору принимается после проверки.
      </Notice>

      <RequireAuth>
        {(u) => {
          const mine = ticketsForUser(s, u).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
          return mine.length === 0 ? (
            <EmptyState icon={<LifeBuoy className="h-7 w-7" aria-hidden />} title="Обращений пока нет" text="Если возникнет вопрос или проблема с заказом — напишите нам." action={{ href: "/support/new", label: "Создать обращение" }} />
          ) : (
            <ul className="space-y-3">
              {mine.map((t) => (
                <li key={t.id}>
                  <Link href={`/support/ticket?id=${t.id}`} className="card card-hover flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 text-xs text-muted">
                        <span className="font-mono font-semibold text-ink">{t.number}</span>
                        <span>{KIND[t.kind]}</span>
                        <span>·</span>
                        <span>{formatDate(t.createdAt, true)}</span>
                      </p>
                      <p className="mt-1 truncate font-medium">{t.subject}</p>
                    </div>
                    <TicketStatusBadge status={t.status} />
                  </Link>
                </li>
              ))}
            </ul>
          );
        }}
      </RequireAuth>
    </div>
  );
}
