"use client";

import { FinanceGate } from "@/components/finance-gate";
import { useState } from "react";
import { DataTable, type Column } from "@/components/data-table";
import { Notice, PageHeader, PayoutStatusBadge, formatDate } from "@/components/ui";
import { formatUZS } from "@/lib/money";
import { PAYOUT_METHOD_LABELS, PAYOUT_STATUS_LABELS, availablePayoutActions, type PayoutAction } from "@/lib/payouts";
import { payoutAction, useDemoState } from "@/lib/store";
import { toast } from "@/lib/toast";
import type { PayoutRequest, PayoutStatus } from "@/lib/types";

const ACTION_LABEL: Record<PayoutAction, string> = { review: "На проверку", approve: "Одобрить", mark_paid: "Отметить выплаченной (тест)", reject: "Отклонить" };

export default function AdminPayoutsPage() {
  return <FinanceGate><AdminPayoutsPageInner /></FinanceGate>;
}

function AdminPayoutsPageInner() {
  const s = useDemoState();
  const [status, setStatus] = useState<PayoutStatus | "">("");
  const [comments, setComments] = useState<Record<string, string>>({});
  const name = (id: string) => s.profiles.find((p) => p.id === id)?.username ?? "—";
  const rows = [...s.payouts].filter((p) => !status || p.status === status).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  function act(p: PayoutRequest, a: PayoutAction) {
    const r = payoutAction(p.id, a, comments[p.id] ?? "");
    if (r.ok) {
      toast.success("Статус заявки обновлён");
      setComments((c) => ({ ...c, [p.id]: "" }));
    } else toast.error(r.error);
  }

  const columns: Column<PayoutRequest>[] = [
    { key: "num", header: "Заявка", render: (p) => <span className="font-mono font-semibold">{p.number}</span> },
    { key: "seller", header: "Продавец", render: (p) => name(p.sellerId) },
    { key: "amount", header: "Сумма", render: (p) => <span className="whitespace-nowrap font-semibold">{formatUZS(p.amountUzs)}</span> },
    { key: "method", header: "Способ", render: (p) => <span className="text-xs text-muted">{PAYOUT_METHOD_LABELS[p.method]}<br />{p.details}</span> },
    { key: "date", header: "Создана", render: (p) => formatDate(p.createdAt) },
    { key: "status", header: "Статус", render: (p) => <PayoutStatusBadge status={p.status} /> },
    {
      key: "actions",
      header: "Рассмотрение",
      render: (p) => {
        const acts = availablePayoutActions(p.status);
        if (acts.length === 0) return <span className="text-xs text-muted">{p.adminComment || "Закрыта"}</span>;
        return (
          <div className="space-y-2">
            <input className="input !py-1.5 text-xs" placeholder="Комментарий (для отклонения обязателен)" aria-label={`Комментарий к ${p.number}`} value={comments[p.id] ?? ""} onChange={(e) => setComments((c) => ({ ...c, [p.id]: e.target.value }))} maxLength={300} />
            <div className="flex flex-wrap gap-1.5">
              {acts.map((a) => (
                <button key={a} type="button" className={a === "reject" ? "btn-danger !px-3 !py-1.5 !text-xs" : "btn-ghost !px-3 !py-1.5 !text-xs"} onClick={() => act(p, a)}>{ACTION_LABEL[a]}</button>
              ))}
            </div>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader title="Заявки на вывод" subtitle="Тестовый режим: статус «Выплачена» — отметка администратора, настоящий перевод не выполняется." />
      <Notice tone="warn">Реальных переводов нет. Не вводите реальные реквизиты. Подключение выплат требует отдельного платёжного партнёра и юридической схемы.</Notice>
      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(p) => p.id}
        searchText={(p) => `${p.number} ${name(p.sellerId)}`}
        searchPlaceholder="Номер или продавец"
        empty="Заявок нет"
        toolbar={
          <select className="input !w-auto" value={status} onChange={(e) => setStatus(e.target.value as PayoutStatus | "")} aria-label="Фильтр по статусу">
            <option value="">Все статусы</option>
            {(Object.keys(PAYOUT_STATUS_LABELS) as PayoutStatus[]).map((k) => <option key={k} value={k}>{PAYOUT_STATUS_LABELS[k]}</option>)}
          </select>
        }
      />
    </div>
  );
}
