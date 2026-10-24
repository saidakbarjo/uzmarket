"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { RequireAuth } from "@/components/require-auth";
import { Field, Notice, PageHeader, Spinner } from "@/components/ui";
import { createTicket, useDemoState } from "@/lib/store";
import { toast } from "@/lib/toast";
import type { Profile, TicketKind } from "@/lib/types";
import type { FieldErrors } from "@/lib/validation";

const DISPUTE_REASONS = [
  "Товар не соответствует описанию",
  "Товар не получен",
  "Не работает ключ или код",
  "Услуга выполнена не в срок",
  "Продавец не выходит на связь",
  "Другое",
];

function Form({ user }: { user: Profile }) {
  const router = useRouter();
  const params = useSearchParams();
  const s = useDemoState();
  const kindParam = params.get("kind");
  const initialKind: TicketKind = kindParam === "dispute" || kindParam === "complaint" ? kindParam : "support";
  const [kind, setKind] = useState<TicketKind>(initialKind);
  const [orderId, setOrderId] = useState(params.get("order") ?? "");
  const [subject, setSubject] = useState((params.get("subject") ?? "").slice(0, 120));
  const [reason, setReason] = useState(initialKind === "dispute" ? DISPUTE_REASONS[0] : "");
  const [description, setDescription] = useState("");
  const [evidence, setEvidence] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);

  // для спора — только заказы покупателя, по которым спор допустим
  const myOrders = s.orders.filter((o) => (o.buyerId === user.id || o.sellerId === user.id));
  const disputable = myOrders.filter((o) => o.buyerId === user.id && ["paid", "in_progress", "delivered"].includes(o.status));
  const orderOptions = kind === "dispute" ? disputable : myOrders;

  function onKind(k: TicketKind) {
    setKind(k);
    setErrors({});
    if (k === "dispute" && !DISPUTE_REASONS.includes(reason)) setReason(DISPUTE_REASONS[0]);
    if (k !== "dispute" && DISPUTE_REASONS.includes(reason)) setReason("");
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const r = createTicket({ kind, orderId: orderId || undefined, subject, reason, description, evidence });
    setBusy(false);
    if (!r.ok) {
      setErrors(r.fieldErrors ?? {});
      toast.error(r.fieldErrors ? "Проверьте поля формы" : r.error);
      return;
    }
    toast.success(kind === "dispute" ? `Спор открыт: ${r.data.number}` : `Обращение создано: ${r.data.number}`);
    router.push(`/support/ticket?id=${r.data.id}`);
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Новое обращение" subtitle="Опишите ситуацию — мы рассмотрим её после проверки." />
      <form onSubmit={onSubmit} className="card space-y-5 p-5 sm:p-6" noValidate>
        <fieldset>
          <legend className="mb-2 text-sm font-medium">Тип обращения</legend>
          <div className="grid gap-2 sm:grid-cols-3" role="radiogroup">
            {([["support", "Вопрос"], ["dispute", "Спор по заказу"], ["complaint", "Жалоба"]] as const).map(([k, label]) => (
              <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => onKind(k)} className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition ${kind === k ? "border-accent bg-accent/15" : "border-line bg-panel-2 text-muted hover:text-ink"}`}>
                {label}
              </button>
            ))}
          </div>
        </fieldset>

        {kind === "dispute" && (
          <Notice tone="warn">
            Спор может открыть только покупатель по оплаченному заказу. После открытия заказ получит статус «Спор». Автоматический возврат денег не гарантируется: решение принимает администратор после проверки.
          </Notice>
        )}

        <Field label={kind === "dispute" ? "Заказ" : "Заказ (необязательно)"} htmlFor="order" error={errors.orderId}>
          <select id="order" className="input" value={orderId} onChange={(e) => setOrderId(e.target.value)}>
            <option value="">{kind === "dispute" ? "Выберите заказ" : "Не связано с заказом"}</option>
            {orderOptions.map((o) => (
              <option key={o.id} value={o.id}>{o.number} — {o.listingTitle.slice(0, 60)}</option>
            ))}
          </select>
          {kind === "dispute" && disputable.length === 0 && <p className="mt-1.5 text-xs text-warn">Нет заказов, по которым можно открыть спор.</p>}
        </Field>

        <Field label="Тема" htmlFor="subject" error={errors.subject}>
          <input id="subject" className="input" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={120} />
        </Field>

        <Field label={kind === "dispute" ? "Причина спора" : "Причина обращения"} htmlFor="reason" error={errors.reason}>
          {kind === "dispute" ? (
            <select id="reason" className="input" value={reason} onChange={(e) => setReason(e.target.value)}>
              {DISPUTE_REASONS.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          ) : (
            <input id="reason" className="input" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={120} placeholder={kind === "complaint" ? "Например: нарушение правил" : "Например: вопрос по оплате"} />
          )}
        </Field>

        <Field label="Описание проблемы" htmlFor="description" error={errors.description} hint={`${description.length}/3000`}>
          <textarea id="description" rows={5} className="input" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={3000} />
        </Field>

        <Field label="Доказательства" htmlFor="evidence" error={errors.evidence} hint="Ссылки на скриншоты, видео, файлы. Не размещайте пароли и платёжные данные. Загрузка файлов появится вместе с Supabase Storage.">
          <textarea id="evidence" rows={3} className="input" value={evidence} onChange={(e) => setEvidence(e.target.value)} maxLength={2000} />
        </Field>

        <button type="submit" className="btn-primary" disabled={busy}>
          {busy && <Spinner />} Отправить
        </button>
      </form>
    </div>
  );
}

export function NewTicketForm() {
  return <RequireAuth>{(user) => <Form user={user} />}</RequireAuth>;
}
