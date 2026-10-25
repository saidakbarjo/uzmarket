"use client";

import { Wallet } from "lucide-react";
import { useState, type FormEvent } from "react";
import { DataTable, type Column } from "@/components/data-table";
import { Field, Notice, PageHeader, PayoutStatusBadge, formatDate } from "@/components/ui";
import { formatUZS } from "@/lib/money";
import { MIN_PAYOUT_UZS, PAYOUT_METHOD_LABELS } from "@/lib/payouts";
import { balanceFor, requestPayout, useCurrentUser, useDemoState } from "@/lib/store";
import { toast } from "@/lib/toast";
import type { LedgerEntry, PayoutMethod } from "@/lib/types";
import type { FieldErrors } from "@/lib/validation";

const KIND: Record<LedgerEntry["kind"], string> = {
  order_paid: "Оплата заказа (ожидает завершения)",
  order_released: "Заказ завершён — средства доступны",
  order_reversed: "Возврат / отмена",
  payout_requested: "Заявка на вывод",
  payout_paid: "Выплата (тест)",
  payout_rejected: "Заявка отклонена — сумма возвращена",
};
const money = (n: number) => (n === 0 ? "—" : `${n > 0 ? "+" : "−"}${formatUZS(Math.abs(n))}`);

export default function SellerFinancePage() {
  const s = useDemoState();
  const { user } = useCurrentUser();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PayoutMethod>("card_demo");
  const [details, setDetails] = useState("Тестовая карта (демо)");
  const [errors, setErrors] = useState<FieldErrors>({});
  if (!user) return null;

  const bal = balanceFor(s, user.id);
  const mine = s.orders.filter((o) => o.sellerId === user.id);
  const sales = mine.filter((o) => o.status === "completed").reduce((a, o) => a + o.priceUzs, 0);
  const fees = mine.filter((o) => o.status === "completed").reduce((a, o) => a + o.commission.sellerFeeUzs, 0);
  const myPayouts = s.payouts.filter((p) => p.sellerId === user.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const ledger = s.ledger.filter((e) => e.userId === user.id).sort((a, b) => b.at.localeCompare(a.at));

  function submit(e: FormEvent) {
    e.preventDefault();
    const n = amount.trim() === "" ? NaN : Number(amount.replace(/\s/g, ""));
    const r = requestPayout({ amountUzs: n, method, details });
    if (!r.ok) {
      setErrors(r.fieldErrors ?? {});
      return toast.error(r.error);
    }
    setErrors({});
    setAmount("");
    toast.success(`Заявка ${r.data.number} создана (тест)`);
  }

  const cards = [
    { label: "Всего продаж (тест)", value: formatUZS(sales) },
    { label: "Удержано комиссий", value: formatUZS(fees) },
    { label: "Доступно к выводу", value: formatUZS(bal.available), strong: true },
    { label: "Ожидает завершения заказа", value: formatUZS(bal.pending) },
    { label: "В обработке (заявки)", value: formatUZS(bal.inPayout) },
    { label: "Выплачено (тест)", value: formatUZS(bal.paid) },
  ];
  const columns: Column<LedgerEntry>[] = [
    { key: "date", header: "Дата", render: (e) => formatDate(e.at, true) },
    { key: "kind", header: "Операция", render: (e) => KIND[e.kind] },
    { key: "ref", header: "Документ", render: (e) => <span className="font-mono text-xs">{s.orders.find((o) => o.id === e.orderId)?.number ?? s.payouts.find((p) => p.id === e.payoutId)?.number ?? "—"}</span> },
    { key: "pending", header: "Ожидает", render: (e) => money(e.pending) },
    { key: "available", header: "Доступно", render: (e) => money(e.available) },
    { key: "inPayout", header: "В выплате", render: (e) => money(e.inPayout) },
    { key: "paid", header: "Выплачено", render: (e) => money(e.paid) },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Финансы и выплаты" subtitle="Тестовый режим: баланс — учёт внутри демо, а не реальные деньги." />
      <Notice tone="warn">Реальных денег нет. Выплата — тестовая заявка: администратор отмечает статус вручную, настоящий перевод не выполняется. Не вводите реальные номера карт и счетов.</Notice>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-3" data-testid="seller-balance">
        {cards.map((c) => (
          <div key={c.label} className={`card p-4 ${c.strong ? "border-accent/50" : ""}`}>
            <p className="text-xs text-muted">{c.label}</p>
            <p className="mt-1 font-display text-xl font-bold sm:text-2xl">{c.value}</p>
          </div>
        ))}
      </div>

      <form onSubmit={submit} className="card grid gap-4 p-5 sm:grid-cols-2" noValidate aria-label="Заявка на вывод">
        <h2 className="flex items-center gap-2 font-semibold sm:col-span-2"><Wallet className="h-5 w-5 text-accent" aria-hidden /> Заявка на вывод</h2>
        <Field label="Сумма, сум" htmlFor="pamount" error={errors.amountUzs} hint={`Минимум ${formatUZS(MIN_PAYOUT_UZS)}; доступно ${formatUZS(bal.available)}`}>
          <input id="pamount" className="input" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <Field label="Способ (тест)" htmlFor="pmethod" error={errors.method}>
          <select id="pmethod" className="input" value={method} onChange={(e) => setMethod(e.target.value as PayoutMethod)}>
            {(Object.keys(PAYOUT_METHOD_LABELS) as PayoutMethod[]).map((m) => <option key={m} value={m}>{PAYOUT_METHOD_LABELS[m]}</option>)}
          </select>
        </Field>
        <div className="sm:col-span-2">
          <Field label="Тестовые реквизиты" htmlFor="pdetails" error={errors.details}><input id="pdetails" className="input" value={details} onChange={(e) => setDetails(e.target.value)} maxLength={100} /></Field>
        </div>
        <div className="sm:col-span-2"><button type="submit" className="btn-primary" disabled={bal.available < MIN_PAYOUT_UZS}>Создать заявку</button></div>
      </form>

      <section aria-labelledby="mp">
        <h2 id="mp" className="mb-3 font-semibold">Мои заявки</h2>
        {myPayouts.length === 0 ? <p className="card p-5 text-sm text-muted">Заявок пока нет.</p> : (
          <ul className="space-y-3">
            {myPayouts.map((p) => (
              <li key={p.id} className="card p-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-mono font-semibold">{p.number}</span><PayoutStatusBadge status={p.status} /></div>
                <p className="mt-1"><b>{formatUZS(p.amountUzs)}</b> · {PAYOUT_METHOD_LABELS[p.method]} · {formatDate(p.createdAt)}</p>
                {p.adminComment && <p className="mt-1 text-xs text-muted">Комментарий администратора: {p.adminComment}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="hist">
        <h2 id="hist" className="mb-3 font-semibold">История финансовых операций</h2>
        <DataTable rows={ledger} columns={columns} rowKey={(e) => e.id} pageSize={8} empty="Операций пока нет" />
      </section>
    </div>
  );
}
