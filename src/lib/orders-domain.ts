import type { Order, OrderEvent, OrderStatus, Profile } from "@/lib/types";

/**
 * Доменные правила заказов. Чистые функции без доступа к браузеру —
 * поэтому их можно переиспользовать на сервере (Route Handlers / Supabase Edge Functions)
 * и покрывать тестами. Права проверяются здесь, а не в интерфейсе.
 *
 * ВАЖНО: в демо-режиме данные лежат в localStorage браузера, поэтому это НЕ защита
 * от злоумышленника с DevTools. Настоящее обеспечение прав в будущем — RLS в Supabase
 * (см. supabase/migrations) и серверные проверки.
 */

export type OrderAction =
  | "pay_success"
  | "pay_fail"
  | "cancel"
  | "start"
  | "deliver"
  | "confirm"
  | "open_dispute"
  | "refund"
  | "resolve_dispute_complete";

export type Actor = Pick<Profile, "id" | "role" | "blocked">;

export class DomainError extends Error {
  constructor(
    message: string,
    public code: "forbidden" | "invalid_state" | "not_found" | "validation",
  ) {
    super(message);
    this.name = "DomainError";
  }
}

interface Rule {
  from: OrderStatus[];
  to: OrderStatus;
  who: ("buyer" | "seller" | "admin" | "system")[];
  note: string;
}

const RULES: Record<OrderAction, Rule> = {
  pay_success: { from: ["pending_payment"], to: "paid", who: ["buyer", "system"], note: "Тестовая оплата прошла (DEMO — реальные деньги не переводятся)." },
  pay_fail: { from: ["pending_payment"], to: "pending_payment", who: ["buyer", "system"], note: "Тестовая оплата не прошла. Можно попробовать снова." },
  cancel: { from: ["pending_payment", "paid"], to: "cancelled", who: ["buyer", "seller", "admin"], note: "Заказ отменён." },
  start: { from: ["paid"], to: "in_progress", who: ["seller"], note: "Продавец приступил к выполнению." },
  deliver: { from: ["paid", "in_progress"], to: "delivered", who: ["seller"], note: "Продавец отметил заказ как выданный." },
  confirm: { from: ["delivered"], to: "completed", who: ["buyer"], note: "Покупатель подтвердил получение. Заказ завершён." },
  open_dispute: { from: ["paid", "in_progress", "delivered"], to: "disputed", who: ["buyer"], note: "Покупатель открыл спор." },
  refund: { from: ["paid", "in_progress", "delivered", "disputed"], to: "refunded", who: ["admin"], note: "Возврат оформлен в тестовом режиме (DEMO — без движения денег)." },
  resolve_dispute_complete: { from: ["disputed"], to: "completed", who: ["admin"], note: "Спор решён в пользу выполнения заказа." },
};

export function roleOf(order: Order, actor: Actor | "system"): "buyer" | "seller" | "admin" | "system" | null {
  if (actor === "system") return "system";
  if (actor.role === "admin") return "admin";
  if (actor.id === order.buyerId) return "buyer";
  if (actor.id === order.sellerId) return "seller";
  return null;
}

export function canView(order: Order, actor: Actor | null): boolean {
  if (!actor || actor.blocked) return false;
  return actor.role === "admin" || actor.id === order.buyerId || actor.id === order.sellerId;
}

function newId(prefix: string): string {
  const rnd =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${rnd}`;
}

/**
 * Применяет действие к заказу и возвращает НОВЫЙ объект заказа.
 * Исходный заказ не мутируется. Цена и стороны сделки никогда не меняются.
 */
export function applyAction(
  order: Order,
  action: OrderAction,
  actor: Actor | "system",
  now: Date = new Date(),
  note?: string,
): Order {
  if (actor !== "system" && actor.blocked) {
    throw new DomainError("Аккаунт заблокирован", "forbidden");
  }
  const rule = RULES[action];
  const role = roleOf(order, actor);
  if (!role || !rule.who.includes(role)) {
    throw new DomainError("Нет прав на это действие", "forbidden");
  }
  if (!rule.from.includes(order.status)) {
    throw new DomainError("Действие недоступно в текущем статусе заказа", "invalid_state");
  }
  const at = now.toISOString();
  const event: OrderEvent = {
    id: newId("ev"),
    at,
    status: rule.to,
    actorId: actor === "system" ? "system" : actor.id,
    note: note ? `${rule.note} ${note}` : rule.note,
  };
  return {
    ...order,
    status: rule.to,
    updatedAt: at,
    events: [...order.events, event],
    // цена, комиссия, покупатель и продавец сознательно не перезаписываются
  };
}

export function addMessage(order: Order, actor: Actor, text: string, now: Date = new Date()): Order {
  if (!canView(order, actor)) throw new DomainError("Нет доступа к заказу", "forbidden");
  const clean = text.trim();
  if (!clean || clean.length > 1000) throw new DomainError("Некорректное сообщение", "validation");
  if (["completed", "cancelled", "refunded"].includes(order.status) && actor.role !== "admin") {
    throw new DomainError("Чат закрыт: заказ завершён", "invalid_state");
  }
  const at = now.toISOString();
  return {
    ...order,
    updatedAt: at,
    messages: [...order.messages, { id: newId("m"), at, authorId: actor.id, text: clean }],
  };
}

export function setFulfillmentNote(order: Order, actor: Actor, note: string): Order {
  if (roleOf(order, actor) !== "seller") throw new DomainError("Только продавец может заполнить информацию о выполнении", "forbidden");
  if (!["paid", "in_progress"].includes(order.status)) throw new DomainError("Заказ нельзя изменить в этом статусе", "invalid_state");
  const clean = note.trim();
  if (clean.length < 3 || clean.length > 2000) throw new DomainError("Опишите выполнение (3–2000 символов)", "validation");
  return { ...order, fulfillmentNote: clean, updatedAt: new Date().toISOString() };
}

export const STATUS_LABELS: Record<OrderStatus, string> = {
  pending_payment: "Ожидает оплаты",
  paid: "Оплачен (тест)",
  in_progress: "В работе",
  delivered: "Выдан",
  completed: "Завершён",
  disputed: "Спор",
  cancelled: "Отменён",
  refunded: "Возврат (тест)",
};

export function availableActions(order: Order, actor: Actor | null): OrderAction[] {
  if (!actor) return [];
  const role = roleOf(order, actor);
  if (!role) return [];
  return (Object.keys(RULES) as OrderAction[]).filter((a) => {
    const r = RULES[a];
    return r.who.includes(role) && r.from.includes(order.status) && a !== "pay_fail";
  });
}
