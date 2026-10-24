"use client";

import Link from "next/link";
import {
  AlertOctagon,
  Ban,
  CheckCircle2,
  Circle,
  CircleDot,
  CreditCard,
  Flag,
  PackageCheck,
  Play,
  RefreshCcw,
  Repeat2,
  Send,
  ShieldAlert,
  Undo2,
  XCircle,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import { RequireAuth } from "@/components/require-auth";
import { ReviewForm } from "@/components/review-form";
import { ConfirmButton, DemoBadge, EmptyState, Field, Notice, OrderStatusBadge, formatDate } from "@/components/ui";
import { FEE_PERCENT, formatUZS } from "@/lib/money";
import { availableActions, canView, roleOf, STATUS_LABELS, type OrderAction } from "@/lib/orders-domain";
import { DEMO_BANNER } from "@/lib/payments/provider";
import {
  orderAction,
  payOrder,
  replayLastPaymentEvent,
  saveFulfillment,
  sendOrderMessage,
  useDemoState,
} from "@/lib/store";
import { toast } from "@/lib/toast";
import type { Order, Profile } from "@/lib/types";

function OrderView({ order, user }: { order: Order; user: Profile }) {
  const s = useDemoState();
  const buyer = s.profiles.find((p) => p.id === order.buyerId);
  const seller = s.profiles.find((p) => p.id === order.sellerId);
  const role = roleOf(order, user);
  const actions = availableActions(order, user);
  const [msg, setMsg] = useState("");
  const [note, setNote] = useState(order.fulfillmentNote ?? "");
  const [busy, setBusy] = useState(false);
  const hasReview = s.reviews.some((r) => r.orderId === order.id);
  const ticket = s.tickets.find((t) => t.orderId === order.id && t.kind === "dispute");
  const lastEvent = s.lastEvents[order.id];

  const nameOf = (id: string) => (id === "system" ? "Система" : (s.profiles.find((p) => p.id === id)?.username ?? "Пользователь"));

  function run(action: OrderAction, okText: string) {
    const r = orderAction(order.id, action);
    if (r.ok) toast.success(okText);
    else toast.error(r.error);
  }

  function pay(outcome: "success" | "fail" | "cancel") {
    setBusy(true);
    const r = payOrder(order.id, outcome);
    setBusy(false);
    if (!r.ok) toast.error(r.error);
    else if (outcome === "success") toast.success(r.data.message);
    else toast.info(r.data.message);
  }

  function onSendMessage(e: FormEvent) {
    e.preventDefault();
    const r = sendOrderMessage(order.id, msg);
    if (r.ok) setMsg("");
    else toast.error(r.error);
  }

  function onSaveNote(e: FormEvent) {
    e.preventDefault();
    const r = saveFulfillment(order.id, note);
    if (r.ok) toast.success("Информация о выполнении сохранена");
    else toast.error(r.error);
  }

  const closed = ["completed", "cancelled", "refunded"].includes(order.status);
  const canSellerEditNote = role === "seller" && ["paid", "in_progress"].includes(order.status);

  return (
    <div className="space-y-6">
      <nav className="text-sm text-muted" aria-label="Навигация">
        <Link href="/account/orders" className="hover:text-ink">Мои заказы</Link>
        <span className="mx-2">/</span>
        <span className="font-mono text-ink">{order.number}</span>
      </nav>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-2xl font-bold sm:text-3xl">Заказ {order.number}</h1>
            <OrderStatusBadge status={order.status} />
            {order.isDemo && <DemoBadge label="Тестовая сделка" />}
          </div>
          <Link href={`/listing/${order.listingId}`} className="mt-1 block truncate text-sm text-accent hover:underline">{order.listingTitle}</Link>
        </div>
        <p className="rounded-lg border border-warn/30 bg-warn/10 px-3 py-2 text-xs font-semibold text-warn">{DEMO_BANNER}</p>
      </div>

      {role === "admin" && <Notice tone="info">Вы просматриваете заказ как администратор.</Notice>}

      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          {/* Действия по статусу */}
          {order.status === "pending_payment" && role === "buyer" && (
            <section className="card space-y-4 border-accent/40 p-5" aria-labelledby="pay">
              <h2 id="pay" className="flex items-center gap-2 font-semibold"><CreditCard className="h-5 w-5 text-accent" aria-hidden /> Тестовая оплата</h2>
              <Notice tone="warn">
                <b>{DEMO_BANNER}.</b> Это демонстрационный платёжный модуль: вы можете проверить успешный, неуспешный платёж и отмену. Настоящей платёжной системы и эскроу пока нет.
              </Notice>
              <div className="grid gap-2 sm:grid-cols-3">
                <button type="button" className="btn-primary" disabled={busy} onClick={() => pay("success")}><CheckCircle2 className="h-4 w-4" aria-hidden /> Оплатить (тест)</button>
                <button type="button" className="btn-ghost" disabled={busy} onClick={() => pay("fail")}><XCircle className="h-4 w-4" aria-hidden /> Имитировать отказ</button>
                <ConfirmButton
                  label="Отменить заказ"
                  title="Отменить заказ?"
                  description="Заказ будет отменён. Это действие нельзя отменить."
                  confirmLabel="Отменить заказ"
                  icon={<Ban className="h-4 w-4" aria-hidden />}
                  onConfirm={() => pay("cancel")}
                />
              </div>
            </section>
          )}

          {order.status === "pending_payment" && role === "seller" && <Notice>Ожидаем тестовую оплату от покупателя.</Notice>}

          {role === "seller" && order.status === "paid" && (
            <Notice tone="ok">Заказ оплачен (тест). Приступите к выполнению и заполните информацию о выполнении.</Notice>
          )}

          {order.status === "delivered" && role === "buyer" && (
            <section className="card space-y-3 border-ok/40 p-5" aria-labelledby="confirm">
              <h2 id="confirm" className="flex items-center gap-2 font-semibold"><PackageCheck className="h-5 w-5 text-ok" aria-hidden /> Проверьте результат</h2>
              <p className="text-sm text-muted">Продавец отметил заказ как выданный. Если всё в порядке — подтвердите получение. Если нет — откройте спор.</p>
              <div className="flex flex-wrap gap-2">
                {actions.includes("confirm") && (
                  <ConfirmButton
                    label="Подтвердить получение"
                    className="btn-primary"
                    title="Подтвердить получение?"
                    description="После подтверждения заказ будет завершён, а вернуть его в работу нельзя."
                    confirmLabel="Подтвердить"
                    icon={<CheckCircle2 className="h-4 w-4" aria-hidden />}
                    onConfirm={() => run("confirm", "Заказ завершён. Спасибо!")}
                  />
                )}
                <Link href={`/support/new?kind=dispute&order=${order.id}`} className="btn-danger"><Flag className="h-4 w-4" aria-hidden /> Открыть спор</Link>
              </div>
            </section>
          )}

          {order.status === "disputed" && (
            <Notice tone="danger">
              <b>По заказу открыт спор.</b> Администратор рассмотрит обращение и приложенные доказательства. Площадка не обещает автоматический возврат денег.{" "}
              {ticket && <Link href={`/support/${ticket.id}`} className="font-semibold text-accent hover:underline">Открыть обращение {ticket.number}</Link>}
            </Notice>
          )}

          {order.status === "completed" && role === "buyer" && !hasReview && (
            <section className="card space-y-3 p-5" aria-labelledby="leave-review">
              <h2 id="leave-review" className="font-semibold">Оставьте отзыв</h2>
              <ReviewForm orderId={order.id} />
            </section>
          )}

          {/* Сводка и действия сторон */}
          <section className="card p-5" aria-labelledby="actions">
            <h2 id="actions" className="mb-4 font-semibold">Управление заказом</h2>
            {actions.filter((a) => a !== "open_dispute").length === 0 ? (
              <p className="text-sm text-muted">{closed ? "Заказ закрыт — дальнейшие действия недоступны." : "Сейчас для вас нет доступных действий."}</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {actions.includes("start") && (
                  <button type="button" className="btn-primary" onClick={() => run("start", "Заказ взят в работу")}><Play className="h-4 w-4" aria-hidden /> Приступить к выполнению</button>
                )}
                {actions.includes("deliver") && (
                  <button type="button" className="btn-primary" onClick={() => run("deliver", "Заказ отмечен как выданный")}><PackageCheck className="h-4 w-4" aria-hidden /> Отметить «Выдан»</button>
                )}
                {actions.includes("resolve_dispute_complete") && (
                  <ConfirmButton
                    label="Решить спор: завершить заказ"
                    className="btn-ghost"
                    title="Завершить заказ по спору?"
                    description="Спор будет закрыт в пользу выполнения заказа."
                    confirmLabel="Завершить"
                    icon={<CheckCircle2 className="h-4 w-4" aria-hidden />}
                    onConfirm={() => run("resolve_dispute_complete", "Спор решён, заказ завершён")}
                  />
                )}
                {actions.includes("refund") && (
                  <ConfirmButton
                    label="Тестовый возврат"
                    title="Оформить возврат (тест)?"
                    description="Заказ получит статус «Возврат (тест)». Реальные деньги не двигаются — это демонстрация."
                    confirmLabel="Оформить возврат"
                    icon={<Undo2 className="h-4 w-4" aria-hidden />}
                    onConfirm={() => run("refund", "Тестовый возврат оформлен")}
                  />
                )}
                {actions.includes("cancel") && order.status !== "pending_payment" && (
                  <ConfirmButton
                    label="Отменить заказ"
                    title="Отменить заказ?"
                    description="Заказ будет отменён. Это действие нельзя отменить."
                    confirmLabel="Отменить заказ"
                    icon={<Ban className="h-4 w-4" aria-hidden />}
                    onConfirm={() => run("cancel", "Заказ отменён")}
                  />
                )}
              </div>
            )}

            {lastEvent && (
              <div className="mt-5 border-t border-line pt-4">
                <p className="mb-2 text-xs text-muted">Проверка идемпотентности (тест): платёжный провайдер повторно присылает последнее уведомление — повторная обработка должна быть проигнорирована.</p>
                <button
                  type="button"
                  className="btn-ghost !py-2"
                  onClick={() => {
                    const r = replayLastPaymentEvent(order.id);
                    if (r.ok) toast.info(r.data.applied ? "Событие применено" : "Повтор проигнорирован: статус не изменился");
                    else toast.error(r.error);
                  }}
                >
                  <Repeat2 className="h-4 w-4" aria-hidden /> Повторить уведомление
                </button>
              </div>
            )}
          </section>

          {/* Информация о выполнении */}
          <section className="card p-5" aria-labelledby="fulfil">
            <h2 id="fulfil" className="mb-3 font-semibold">Информация о выполнении</h2>
            {canSellerEditNote ? (
              <form onSubmit={onSaveNote} className="space-y-3">
                <Field label="Что сделано / как получить результат" htmlFor="note" hint="Не размещайте здесь пароли и платёжные данные.">
                  <textarea id="note" rows={4} className="input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} />
                </Field>
                <button type="submit" className="btn-ghost">Сохранить</button>
              </form>
            ) : order.fulfillmentNote ? (
              <p className="whitespace-pre-line text-sm">{order.fulfillmentNote}</p>
            ) : (
              <p className="text-sm text-muted">Продавец ещё не добавил информацию о выполнении.</p>
            )}
          </section>

          {/* Чат */}
          <section className="card p-5" aria-labelledby="chat">
            <h2 id="chat" className="mb-3 font-semibold">Сообщения по заказу</h2>
            <div className="max-h-96 space-y-3 overflow-y-auto pr-1" role="log" aria-live="polite">
              {order.messages.length === 0 && <p className="text-sm text-muted">Сообщений пока нет. Напишите первым.</p>}
              {order.messages.map((m) => {
                const mine = m.authorId === user.id;
                const system = m.authorId === "system";
                return (
                  <div key={m.id} className={`flex ${system ? "justify-center" : mine ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${system ? "border border-line bg-panel-2 text-xs text-muted" : mine ? "bg-gradient-to-r from-accent to-accent-2 text-white" : "bg-panel-2"}`}>
                      {!system && <p className={`mb-0.5 text-xs font-semibold ${mine ? "text-white/80" : "text-accent"}`}>{nameOf(m.authorId)}</p>}
                      <p className="whitespace-pre-wrap break-words">{m.text}</p>
                      <p className={`mt-1 text-[10px] ${mine ? "text-white/70" : "text-muted"}`}>{formatDate(m.at, true)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
            {closed && role !== "admin" ? (
              <p className="mt-4 text-xs text-muted">Чат закрыт: заказ завершён.</p>
            ) : (
              <form onSubmit={onSendMessage} className="mt-4 flex gap-2">
                <label htmlFor="msg" className="sr-only">Сообщение</label>
                <input id="msg" className="input" value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Ваше сообщение…" maxLength={1000} />
                <button type="submit" className="btn-primary shrink-0" disabled={!msg.trim()} aria-label="Отправить сообщение"><Send className="h-4 w-4" /></button>
              </form>
            )}
            <p className="mt-3 text-xs text-muted">Не передавайте пароли и платёжные данные в чате. Вся переписка сохраняется для разбора споров.</p>
          </section>
        </div>

        {/* Сайдбар */}
        <aside className="space-y-6">
          <section className="card p-5" aria-labelledby="summary">
            <h2 id="summary" className="mb-3 font-semibold">Детали сделки</h2>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-muted">Номер</dt><dd className="font-mono font-semibold">{order.number}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted">Покупатель</dt><dd className="font-medium">{buyer?.username ?? "—"}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted">Продавец</dt><dd className="font-medium">{seller?.username ?? "—"}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted">Создан</dt><dd>{formatDate(order.createdAt, true)}</dd></div>
              <div className="border-t border-line pt-3">
                <div className="flex justify-between gap-3"><dt className="text-muted">Цена (зафиксирована)</dt><dd className="font-display text-lg font-bold">{formatUZS(order.priceUzs)}</dd></div>
                <div className="mt-1 flex justify-between gap-3 text-xs"><dt className="text-muted">Комиссия (демо, {FEE_PERCENT}%)</dt><dd>{formatUZS(order.feeUzs)}</dd></div>
                <div className="mt-1 flex justify-between gap-3 text-xs"><dt className="text-muted">Продавцу (условно)</dt><dd>{formatUZS(order.priceUzs - order.feeUzs)}</dd></div>
              </div>
            </dl>
            <p className="mt-4 text-xs text-muted">Статусы в демо-режиме не означают реальных денежных операций.</p>
          </section>

          <section className="card p-5" aria-labelledby="timeline">
            <h2 id="timeline" className="mb-4 font-semibold">Хронология</h2>
            <ol className="relative space-y-5 border-l border-line pl-5">
              {order.events.map((ev, i) => {
                const last = i === order.events.length - 1;
                const Icon = last ? CircleDot : Circle;
                return (
                  <li key={ev.id} className="relative">
                    <Icon className={`absolute -left-[1.85rem] top-0.5 h-3.5 w-3.5 rounded-full bg-panel ${last ? "text-accent" : "text-muted"}`} aria-hidden />
                    <p className="text-sm font-medium">{STATUS_LABELS[ev.status]}</p>
                    <p className="text-xs text-muted">{ev.note}</p>
                    <p className="mt-0.5 text-[11px] text-muted">{nameOf(ev.actorId)} · {formatDate(ev.at, true)}</p>
                  </li>
                );
              })}
            </ol>
          </section>

          {(role === "buyer" || role === "seller") && !closed && order.status !== "disputed" && (
            <Link href={`/support/new?kind=support&order=${order.id}`} className="btn-ghost w-full"><ShieldAlert className="h-4 w-4" aria-hidden /> Написать в поддержку</Link>
          )}
          {order.status === "refunded" && <Notice><RefreshCcw className="mr-1 inline h-4 w-4" aria-hidden /> Тестовый возврат оформлен без движения денег.</Notice>}
          {order.status === "cancelled" && <Notice><AlertOctagon className="mr-1 inline h-4 w-4" aria-hidden /> Заказ отменён.</Notice>}
        </aside>
      </div>
    </div>
  );
}

export function OrderClient({ id }: { id: string }) {
  const s = useDemoState();
  return (
    <RequireAuth>
      {(user) => {
        const order = s.orders.find((o) => o.id === id);
        // посторонним не раскрываем даже факт существования заказа
        if (!order || !canView(order, user)) {
          return <EmptyState icon={<ShieldAlert className="h-7 w-7" aria-hidden />} title="Заказ не найден" text="Заказа не существует или у вас нет к нему доступа." action={{ href: "/account/orders", label: "Мои заказы" }} />;
        }
        return <OrderView order={order} user={user} />;
      }}
    </RequireAuth>
  );
}
