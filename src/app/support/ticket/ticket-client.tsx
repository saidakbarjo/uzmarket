"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Gavel, HelpCircle, Send, ShieldAlert } from "lucide-react";
import { useState, type FormEvent } from "react";
import { RequireAuth } from "@/components/require-auth";
import { EmptyState, Field, Notice, TicketStatusBadge, formatDate } from "@/components/ui";
import { canAccessTicket, replyTicket, requestDisputeInfo, resolveDispute, useDemoState } from "@/lib/store";
import { toast } from "@/lib/toast";
import type { DisputeDecision, Profile, Ticket } from "@/lib/types";

const KIND = { support: "Вопрос", dispute: "Спор по заказу", complaint: "Жалоба" } as const;
const DECISION_LABEL: Record<DisputeDecision, string> = { refund_buyer: "В пользу покупателя: возврат (тест)", complete_seller: "В пользу продавца: заказ завершён" };

function AdminDisputePanel({ t }: { t: Ticket }) {
  const [info, setInfo] = useState("");
  const [decision, setDecision] = useState<DisputeDecision>("refund_buyer");
  const [comment, setComment] = useState("");
  const [err, setErr] = useState("");

  function onInfo(e: FormEvent) {
    e.preventDefault();
    const r = requestDisputeInfo(t.id, info);
    if (r.ok) {
      setInfo("");
      toast.success("Запрос отправлен сторонам спора");
    } else toast.error(r.error);
  }
  function onDecide(e: FormEvent) {
    e.preventDefault();
    const r = resolveDispute(t.id, { decision, comment });
    if (r.ok) {
      toast.success("Решение принято и записано в журнал");
      setErr("");
    } else {
      setErr(r.fieldErrors?.comment ?? r.error);
      toast.error(r.error);
    }
  }

  return (
    <section className="card space-y-5 border-accent/40 p-5" aria-labelledby="adm">
      <h2 id="adm" className="flex items-center gap-2 font-semibold"><Gavel className="h-5 w-5 text-accent" aria-hidden /> Решение администратора</h2>
      <form onSubmit={onInfo} className="space-y-2">
        <Field label="Запросить дополнительные сведения у сторон" htmlFor="info">
          <input id="info" className="input" value={info} onChange={(e) => setInfo(e.target.value)} maxLength={1000} placeholder="Например: пришлите запись экрана" />
        </Field>
        <button type="submit" className="btn-ghost" disabled={!info.trim()}><HelpCircle className="h-4 w-4" aria-hidden /> Запросить сведения</button>
      </form>
      <form onSubmit={onDecide} className="space-y-3 border-t border-line pt-4">
        <Field label="Решение" htmlFor="decision">
          <select id="decision" className="input" value={decision} onChange={(e) => setDecision(e.target.value as DisputeDecision)}>
            {(Object.keys(DECISION_LABEL) as DisputeDecision[]).map((k) => <option key={k} value={k}>{DECISION_LABEL[k]}</option>)}
          </select>
        </Field>
        <Field label="Обоснование (увидят обе стороны)" htmlFor="dcomment" error={err}>
          <textarea id="dcomment" rows={3} className="input" value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1000} />
        </Field>
        <button type="submit" className="btn-primary">Принять решение</button>
        <p className="text-xs text-muted">Возврат в демо-режиме — тестовая операция: ожидаемый доход продавца снимается, остаток товара возвращается, реальные деньги не двигаются.</p>
      </form>
    </section>
  );
}

function TicketView({ t, user }: { t: Ticket; user: Profile }) {
  const s = useDemoState();
  const [text, setText] = useState("");
  const [evidence, setEvidence] = useState("");
  const order = t.orderId ? s.orders.find((o) => o.id === t.orderId) : undefined;
  const author = s.profiles.find((p) => p.id === t.authorId);
  const closed = ["resolved", "rejected"].includes(t.status);
  const nameOf = (id: string) => {
    if (id === "staff") return "Администрация UZMARKET";
    const p = s.profiles.find((x) => x.id === id);
    if (!p) return "Пользователь";
    const side = order ? (id === order.buyerId ? "покупатель" : id === order.sellerId ? "продавец" : "") : "";
    return side ? `${p.username} (${side})` : p.username;
  };

  function onReply(e: FormEvent) {
    e.preventDefault();
    const r = replyTicket(t.id, text, evidence);
    if (r.ok) {
      setText("");
      setEvidence("");
      toast.success("Сообщение отправлено");
    } else toast.error(r.error);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <nav className="text-sm text-muted" aria-label="Навигация">
        <Link href={user.role === "admin" ? "/admin/disputes" : "/support"} className="hover:text-ink">Обращения</Link>
        <span className="mx-2">/</span>
        <span className="font-mono text-ink">{t.number}</span>
      </nav>

      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-display text-2xl font-bold">{t.subject}</h1>
          <TicketStatusBadge status={t.status} />
        </div>
        <p className="mt-1 text-sm text-muted">{KIND[t.kind]} · {t.number} · {formatDate(t.createdAt, true)}{user.role === "admin" && author ? ` · автор: ${author.username}` : ""}</p>
      </div>

      {t.kind === "dispute" && (
        <Notice tone="warn">Автоматический возврат не обещается: решение принимает администратор после проверки доводов обеих сторон. В демо-режиме деньги не двигаются.</Notice>
      )}

      {t.resolution && (
        <Notice tone="ok">
          <b>Решение администратора: {DECISION_LABEL[t.resolution.decision]}.</b>
          <span className="mt-1 block">{t.resolution.comment}</span>
          <span className="mt-1 block text-xs text-muted">{formatDate(t.resolution.at, true)}</span>
        </Notice>
      )}

      <section className="card space-y-4 p-5" aria-labelledby="det">
        <h2 id="det" className="font-semibold">Содержание</h2>
        <dl className="space-y-3 text-sm">
          <div><dt className="text-muted">Причина</dt><dd className="font-medium">{t.reason}</dd></div>
          {order && <div><dt className="text-muted">Заказ</dt><dd><Link href={`/orders?id=${order.id}`} className="font-mono font-semibold text-accent hover:underline">{order.number}</Link> — {order.listingTitle}</dd></div>}
          <div><dt className="text-muted">Описание</dt><dd className="whitespace-pre-line">{t.description}</dd></div>
          <div><dt className="text-muted">Доказательства</dt><dd className="whitespace-pre-line">{t.evidence || "Не приложены"}</dd></div>
        </dl>
      </section>

      {t.kind === "dispute" && user.role === "admin" && !closed && <AdminDisputePanel t={t} />}

      <section className="card p-5" aria-labelledby="thread">
        <h2 id="thread" className="mb-4 font-semibold">{t.kind === "dispute" ? "Позиции сторон и переписка" : "Переписка"}</h2>
        {t.replies.length === 0 ? (
          <p className="text-sm text-muted">Ответов пока нет.</p>
        ) : (
          <ul className="space-y-3">
            {t.replies.map((r) => (
              <li key={r.id} className={`rounded-2xl px-4 py-3 text-sm ${r.authorId === "staff" ? "border border-accent/30 bg-accent/10" : "bg-panel-2"}`}>
                <p className="mb-0.5 text-xs font-semibold text-accent">
                  {nameOf(r.authorId)}
                  {r.kind === "info_request" && " · запрос сведений"}
                  {r.kind === "decision" && " · решение"}
                </p>
                <p className="whitespace-pre-line">{r.text}</p>
                {r.evidence && <p className="mt-2 rounded-lg border border-line bg-bg/40 p-2 text-xs"><b>Доказательство:</b> {r.evidence}</p>}
                <p className="mt-1 text-[11px] text-muted">{formatDate(r.at, true)}</p>
              </li>
            ))}
          </ul>
        )}
        {closed && user.role !== "admin" ? (
          <p className="mt-4 text-xs text-muted">Обращение закрыто. При необходимости создайте новое.</p>
        ) : (
          <form onSubmit={onReply} className="mt-4 space-y-2">
            <label htmlFor="reply" className="sr-only">Ответ</label>
            <textarea id="reply" rows={2} className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Ваше сообщение или позиция по спору…" maxLength={1000} />
            {t.kind === "dispute" && user.role !== "admin" && (
              <input className="input" aria-label="Доказательства" value={evidence} onChange={(e) => setEvidence(e.target.value)} placeholder="Доказательства: описание скриншота/записи, ссылка (разрешены только материалы по этому заказу)" maxLength={1000} />
            )}
            <button type="submit" className="btn-primary" disabled={!text.trim()}><Send className="h-4 w-4" aria-hidden /> Отправить</button>
          </form>
        )}
        {t.kind === "dispute" && <p className="mt-3 text-xs text-muted">Прикладывайте только материалы по этому заказу. Не публикуйте пароли, платёжные и чужие личные данные.</p>}
      </section>
    </div>
  );
}

export function TicketClient({ id }: { id: string }) {
  const s = useDemoState();
  return (
    <RequireAuth>
      {(user) => {
        const t = s.tickets.find((x) => x.id === id);
        if (!t || !canAccessTicket(s, user, t)) {
          return <EmptyState icon={<ShieldAlert className="h-7 w-7" aria-hidden />} title="Обращение не найдено" text="Обращения не существует или у вас нет к нему доступа." action={{ href: "/support", label: "К обращениям" }} />;
        }
        return <TicketView t={t} user={user} />;
      }}
    </RequireAuth>
  );
}

/** Читает id из адреса (?id=...): так работает и статическая публикация. */
export function TicketPageClient() {
  const id = useSearchParams().get("id") ?? "";
  return <TicketClient id={id} />;
}
