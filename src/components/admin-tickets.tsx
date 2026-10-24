"use client";

import Link from "next/link";
import { useState } from "react";
import { DataTable, type Column } from "@/components/data-table";
import { Badge, ConfirmButton, TicketStatusBadge, formatDate, ticketStatusLabels } from "@/components/ui";
import { setTicketStatus, useDemoState } from "@/lib/store";
import { toast } from "@/lib/toast";
import type { Ticket, TicketKind, TicketStatus } from "@/lib/types";

const KIND_LABEL: Record<TicketKind, string> = { support: "Вопрос", dispute: "Спор", complaint: "Жалоба" };

export function AdminTickets({ kinds }: { kinds: TicketKind[] }) {
  const s = useDemoState();
  const [status, setStatus] = useState<TicketStatus | "">("");
  const rows = s.tickets
    .filter((t) => kinds.includes(t.kind) && (!status || t.status === status))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const name = (id: string) => s.profiles.find((p) => p.id === id)?.username ?? "—";

  function change(t: Ticket, next: TicketStatus, okText: string) {
    const r = setTicketStatus(t.id, next);
    if (r.ok) toast.success(okText);
    else toast.error(r.error);
  }

  const columns: Column<Ticket>[] = [
    { key: "num", header: "Номер", render: (t) => <Link href={`/support/${t.id}`} className="font-mono font-semibold text-accent hover:underline">{t.number}</Link> },
    { key: "kind", header: "Тип", render: (t) => <Badge tone={t.kind === "dispute" ? "danger" : "neutral"}>{KIND_LABEL[t.kind]}</Badge> },
    { key: "subject", header: "Тема", render: (t) => <span className="line-clamp-2">{t.subject}</span> },
    { key: "author", header: "Автор", render: (t) => name(t.authorId) },
    { key: "order", header: "Заказ", render: (t) => { const o = s.orders.find((x) => x.id === t.orderId); return o ? <Link href={`/orders/${o.id}`} className="font-mono text-xs text-accent hover:underline">{o.number}</Link> : "—"; } },
    { key: "date", header: "Создано", render: (t) => formatDate(t.createdAt) },
    { key: "status", header: "Статус", render: (t) => <TicketStatusBadge status={t.status} /> },
    {
      key: "actions",
      header: "Действия",
      render: (t) => (
        <div className="flex flex-wrap justify-end gap-2 md:justify-start">
          {t.status === "open" && (
            <button type="button" className="btn-ghost !px-3 !py-1.5 !text-xs" onClick={() => change(t, "in_review", "Взято на рассмотрение")}>В работу</button>
          )}
          {["open", "in_review"].includes(t.status) && (
            <>
              <button type="button" className="btn-ghost !px-3 !py-1.5 !text-xs" onClick={() => change(t, "resolved", "Обращение решено")}>Решено</button>
              <ConfirmButton
                label="Отклонить"
                className="btn-danger !px-3 !py-1.5 !text-xs"
                title="Отклонить обращение?"
                description="Автор получит уведомление об отклонении. Статус можно будет изменить позже."
                confirmLabel="Отклонить"
                onConfirm={() => change(t, "rejected", "Обращение отклонено")}
              />
            </>
          )}
          {["resolved", "rejected"].includes(t.status) && (
            <button type="button" className="btn-ghost !px-3 !py-1.5 !text-xs" onClick={() => change(t, "in_review", "Возвращено на рассмотрение")}>Переоткрыть</button>
          )}
        </div>
      ),
    },
  ];

  return (
    <DataTable
      rows={rows}
      columns={columns}
      rowKey={(t) => t.id}
      searchText={(t) => `${t.number} ${t.subject} ${name(t.authorId)}`}
      searchPlaceholder="Номер, тема или автор"
      empty="Обращений нет"
      toolbar={
        <select className="input !w-auto" value={status} onChange={(e) => setStatus(e.target.value as TicketStatus | "")} aria-label="Фильтр по статусу">
          <option value="">Все статусы</option>
          {(Object.keys(ticketStatusLabels) as TicketStatus[]).map((k) => <option key={k} value={k}>{ticketStatusLabels[k]}</option>)}
        </select>
      }
    />
  );
}
