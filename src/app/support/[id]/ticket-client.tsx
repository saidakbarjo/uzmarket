"use client";

import Link from "next/link";
import { Send, ShieldAlert } from "lucide-react";
import { useState, type FormEvent } from "react";
import { RequireAuth } from "@/components/require-auth";
import { EmptyState, Notice, TicketStatusBadge, formatDate } from "@/components/ui";
import { replyTicket, useDemoState } from "@/lib/store";
import { toast } from "@/lib/toast";

const KIND = { support: "Вопрос", dispute: "Спор по заказу", complaint: "Жалоба" } as const;

export function TicketClient({ id }: { id: string }) {
  const s = useDemoState();
  const [text, setText] = useState("");

  return (
    <RequireAuth>
      {(user) => {
        const t = s.tickets.find((x) => x.id === id);
        if (!t || (t.authorId !== user.id && user.role !== "admin")) {
          return <EmptyState icon={<ShieldAlert className="h-7 w-7" aria-hidden />} title="Обращение не найдено" text="Обращения не существует или у вас нет к нему доступа." action={{ href: "/support", label: "К обращениям" }} />;
        }
        const order = t.orderId ? s.orders.find((o) => o.id === t.orderId) : undefined;
        const author = s.profiles.find((p) => p.id === t.authorId);
        const closed = ["resolved", "rejected"].includes(t.status);

        function onReply(e: FormEvent) {
          e.preventDefault();
          const r = replyTicket(t!.id, text);
          if (r.ok) {
            setText("");
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
              <Notice tone="warn">Автоматический возврат денег не обещается: решение принимается администратором после проверки. В демо-режиме деньги не двигаются.</Notice>
            )}

            <section className="card space-y-4 p-5" aria-labelledby="det">
              <h2 id="det" className="font-semibold">Содержание</h2>
              <dl className="space-y-3 text-sm">
                <div><dt className="text-muted">Причина</dt><dd className="font-medium">{t.reason}</dd></div>
                {order && <div><dt className="text-muted">Заказ</dt><dd><Link href={`/orders/${order.id}`} className="font-mono font-semibold text-accent hover:underline">{order.number}</Link> — {order.listingTitle}</dd></div>}
                <div><dt className="text-muted">Описание</dt><dd className="whitespace-pre-line">{t.description}</dd></div>
                <div><dt className="text-muted">Доказательства</dt><dd className="whitespace-pre-line">{t.evidence || "Не приложены"}</dd></div>
              </dl>
            </section>

            <section className="card p-5" aria-labelledby="thread">
              <h2 id="thread" className="mb-4 font-semibold">Переписка</h2>
              {t.replies.length === 0 ? (
                <p className="text-sm text-muted">Ответов пока нет. Мы рассмотрим обращение и ответим здесь.</p>
              ) : (
                <ul className="space-y-3">
                  {t.replies.map((r) => (
                    <li key={r.id} className={`rounded-2xl px-4 py-3 text-sm ${r.authorId === "staff" ? "border border-accent/30 bg-accent/10" : "bg-panel-2"}`}>
                      <p className="mb-0.5 text-xs font-semibold text-accent">{r.authorId === "staff" ? "Поддержка UZMARKET" : (s.profiles.find((p) => p.id === r.authorId)?.username ?? "Пользователь")}</p>
                      <p className="whitespace-pre-line">{r.text}</p>
                      <p className="mt-1 text-[11px] text-muted">{formatDate(r.at, true)}</p>
                    </li>
                  ))}
                </ul>
              )}
              {closed && user.role !== "admin" ? (
                <p className="mt-4 text-xs text-muted">Обращение закрыто. При необходимости создайте новое.</p>
              ) : (
                <form onSubmit={onReply} className="mt-4 flex gap-2">
                  <label htmlFor="reply" className="sr-only">Ответ</label>
                  <input id="reply" className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Ваше сообщение…" maxLength={1000} />
                  <button type="submit" className="btn-primary shrink-0" disabled={!text.trim()} aria-label="Отправить"><Send className="h-4 w-4" /></button>
                </form>
              )}
            </section>
          </div>
        );
      }}
    </RequireAuth>
  );
}
