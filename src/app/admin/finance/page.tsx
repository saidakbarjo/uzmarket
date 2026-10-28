"use client";

import { FinanceGate } from "@/components/finance-gate";
import { DataTable, type Column } from "@/components/data-table";
import { PageHeader, formatDate } from "@/components/ui";
import { formatUZS } from "@/lib/money";
import { useDemoState } from "@/lib/store";
import type { LedgerEntry } from "@/lib/types";

const KIND: Record<LedgerEntry["kind"], string> = {
  order_paid: "Оплата заказа",
  order_released: "Заказ завершён",
  order_reversed: "Возврат / отмена",
  payout_requested: "Заявка на вывод",
  payout_paid: "Выплата (тест)",
  payout_rejected: "Заявка отклонена",
};
const money = (n: number) => (n === 0 ? "—" : `${n > 0 ? "+" : "−"}${formatUZS(Math.abs(n))}`);

export default function AdminFinancePage() {
  return <FinanceGate><AdminFinancePageInner /></FinanceGate>;
}

function AdminFinancePageInner() {
  const s = useDemoState();
  const name = (id: string) => s.profiles.find((p) => p.id === id)?.username ?? "—";
  const rows = [...s.ledger].sort((a, b) => b.at.localeCompare(a.at));
  const order = (id?: string) => s.orders.find((o) => o.id === id)?.number ?? "";
  const payout = (id?: string) => s.payouts.find((p) => p.id === id)?.number ?? "";

  const columns: Column<LedgerEntry>[] = [
    { key: "date", header: "Дата", render: (e) => formatDate(e.at, true) },
    { key: "kind", header: "Операция", render: (e) => <span className="font-medium">{KIND[e.kind]}</span> },
    { key: "ref", header: "Документ", render: (e) => <span className="font-mono text-xs">{order(e.orderId) || payout(e.payoutId) || "—"}</span> },
    { key: "seller", header: "Продавец", render: (e) => name(e.userId) },
    { key: "pending", header: "Ожидает", render: (e) => money(e.pending) },
    { key: "available", header: "Доступно", render: (e) => money(e.available) },
    { key: "inPayout", header: "В выплате", render: (e) => money(e.inPayout) },
    { key: "paid", header: "Выплачено", render: (e) => money(e.paid) },
    { key: "fee", header: "Комиссия платформы", render: (e) => money(e.platformFee) },
  ];

  return (
    <div className="space-y-4">
      <PageHeader title="Финансовые операции" subtitle="Журнал только дополняется и не редактируется. Суммы тестовые (DEMO)." />
      <DataTable rows={rows} columns={columns} rowKey={(e) => e.id} searchText={(e) => `${KIND[e.kind]} ${name(e.userId)} ${order(e.orderId)} ${payout(e.payoutId)}`} searchPlaceholder="Операция, продавец, номер" pageSize={12} />
    </div>
  );
}
