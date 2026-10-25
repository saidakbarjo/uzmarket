import { calcCommission } from "@/lib/commission";
import { onOrderCompleted, onOrderPaid, onOrderReversed, onPayoutPaid, onPayoutRejected, onPayoutRequested } from "@/lib/ledger";
import type {
  AppNotification,
  AuditEntry,
  LedgerEntry,
  Order,
  OrderEvent,
  OrderStatus,
  PayoutRequest,
  Ticket,
} from "@/lib/types";
import { seedCommission, seedIso, seedListings } from "@/lib/data/seed";

const DEMO_PAY = "Тестовая оплата прошла (DEMO — реальные деньги не переводятся).";

const PATHS: Record<OrderStatus, OrderStatus[]> = {
  pending_payment: ["pending_payment"],
  paid: ["pending_payment", "paid"],
  in_progress: ["pending_payment", "paid", "in_progress"],
  delivered: ["pending_payment", "paid", "in_progress", "delivered"],
  completed: ["pending_payment", "paid", "in_progress", "delivered", "completed"],
  disputed: ["pending_payment", "paid", "delivered", "disputed"],
  refund_review: ["pending_payment", "paid", "delivered", "disputed", "refund_review"],
  refunded: ["pending_payment", "paid", "delivered", "disputed", "refunded"],
  cancelled: ["pending_payment", "cancelled"],
};

const NOTES: Record<OrderStatus, string> = {
  pending_payment: "Заказ создан.",
  paid: DEMO_PAY,
  in_progress: "Продавец приступил к выполнению.",
  delivered: "Продавец отметил заказ как выданный.",
  completed: "Покупатель подтвердил получение. Заказ завершён.",
  disputed: "Покупатель открыл спор.",
  refund_review: "Администратор рассматривает возврат.",
  refunded: "Возврат оформлен в тестовом режиме (DEMO — без движения денег).",
  cancelled: "Заказ отменён.",
};

function actorFor(status: OrderStatus, buyer: string, seller: string): string {
  if (["in_progress", "delivered"].includes(status)) return seller;
  if (["refund_review", "refunded"].includes(status)) return "u-founder";
  return buyer;
}

/** daysAgo — когда создан заказ; события идут с шагом в 1–3 часа. */
function mk(n: number, listingId: string, buyerId: string, status: OrderStatus, daysAgo: number, quantity = 1, extra: Partial<Order> = {}): Order {
  const l = seedListings.find((x) => x.id === listingId)!;
  const path = PATHS[status];
  const t0 = new Date(seedIso(daysAgo)).getTime();
  const events: OrderEvent[] = path.map((st, i) => ({
    id: `ev-seed-${n}-${i}`,
    at: new Date(t0 + i * 2 * 3_600_000).toISOString(),
    status: st,
    actorId: actorFor(st, buyerId, l.sellerId),
    note: NOTES[st],
  }));
  const priceUzs = l.priceUzs * quantity;
  return {
    id: `o-seed-${n}`,
    number: `UZM-${100200 + n}`,
    listingId,
    listingTitle: l.title,
    gameSlug: l.gameSlug,
    buyerId,
    sellerId: l.sellerId,
    unitPriceUzs: l.priceUzs,
    quantity,
    priceUzs,
    commission: calcCommission(priceUzs, seedCommission, { gameSlug: l.gameSlug, sellerId: l.sellerId }),
    status,
    createdAt: events[0].at,
    updatedAt: events[events.length - 1].at,
    events,
    messages: [
      {
        id: `m-seed-${n}-0`,
        at: new Date(t0 + 600_000).toISOString(),
        authorId: l.sellerId,
        text: "Здравствуйте! Это тестовый заказ демо-режима. Напишите ваш игровой ID, и я всё выполню.",
      },
    ],
    isDemo: true,
    ...(["delivered", "completed", "disputed", "refunded", "refund_review"].includes(status)
      ? { fulfillmentNote: "Выполнено по игровому ID. Скриншот результата отправлен в чат (тестовые данные)." }
      : {}),
    ...extra,
  };
}

export const seedOrders: Order[] = [
  mk(1, "l-001", "u-timur", "completed", 26),
  mk(2, "l-005", "u-aziza", "completed", 22),
  mk(3, "l-009", "u-nur", "completed", 19),
  mk(4, "l-012", "u-timur", "completed", 17),
  mk(5, "l-018", "u-bek", "completed", 14),
  mk(6, "l-021", "u-jasur", "completed", 12),
  mk(7, "l-024", "u-malika", "completed", 9),
  mk(8, "l-027", "u-nur", "completed", 7, 2),
  mk(9, "l-015", "u-timur", "completed", 5),
  mk(10, "l-003", "u-jasur", "completed", 4),
  mk(11, "l-007", "u-aziza", "completed", 2),
  mk(12, "l-022", "u-timur", "completed", 0.5),
  mk(13, "l-028", "u-nur", "completed", 0.4),
  mk(14, "l-002", "u-timur", "in_progress", 1.2),
  mk(15, "l-004", "u-aziza", "delivered", 3),
  mk(16, "l-008", "u-jasur", "disputed", 2),
  mk(17, "l-014", "u-nur", "paid", 0.2),
  mk(18, "l-020", "u-timur", "refunded", 11),
  mk(19, "l-006", "u-aziza", "cancelled", 6),
];

export const seedTickets: Ticket[] = [
  {
    id: "t-seed-1",
    number: "TCK-5001",
    kind: "dispute",
    authorId: "u-jasur",
    orderId: "o-seed-16",
    subject: "Спор по заказу UZM-100216: урок короче заявленных 60 минут",
    reason: "Товар не соответствует описанию",
    description: "Тестовый спор демо-режима: покупатель считает, что урок длился меньше заявленных 60 минут. Это пример обращения для проверки интерфейса.",
    evidence: "Тестовое доказательство: ссылка на запись экрана (демо).",
    status: "in_review",
    createdAt: seedIso(1.5),
    updatedAt: seedIso(1.2),
    replies: [
      { id: "tr-seed-1", at: seedIso(1.2), authorId: "staff", kind: "message", text: "Тестовый ответ поддержки: запросили у продавца запись урока. Автоматического возврата в демо-режиме нет." },
    ],
  },
];

export const seedNotifications: AppNotification[] = [
  { id: "n-seed-1", userId: "u-nur", text: "Новый тестовый заказ UZM-100217: оплачен, ожидает выполнения.", at: seedIso(0.2), read: false, href: "/orders?id=o-seed-17" },
  { id: "n-seed-2", userId: "u-bek", text: "По заказу UZM-100216 открыт спор.", at: seedIso(1.5), read: false, href: "/orders?id=o-seed-16" },
];

/* ───────────── финансы: леджер и заявки на вывод, согласованные с заказами ───────────── */

function ledgerFromOrders(orders: Order[]): LedgerEntry[] {
  const out: LedgerEntry[] = [];
  for (const o of orders) {
    const at = (st: OrderStatus) => o.events.find((e) => e.status === st)?.at;
    const paidAt = at("paid");
    if (!paidAt) continue;
    out.push(onOrderPaid(o, paidAt));
    if (o.status === "completed") out.push(onOrderCompleted(o, at("completed")!));
    if (o.status === "refunded") out.push(onOrderReversed(o, at("refunded")!));
  }
  return out;
}

const mkPayout = (n: number, sellerId: string, amountUzs: number, status: PayoutRequest["status"], daysAgo: number, comment: string): PayoutRequest => {
  const created = seedIso(daysAgo);
  const steps: PayoutRequest["status"][] =
    status === "paid" ? ["created", "in_review", "approved", "paid"] : status === "rejected" ? ["created", "in_review", "rejected"] : status === "in_review" ? ["created", "in_review"] : ["created"];
  return {
    id: `p-seed-${n}`,
    number: `PAY-${7000 + n}`,
    sellerId,
    amountUzs,
    method: "card_demo",
    details: "Тестовая карта (демо)",
    status,
    adminComment: comment,
    createdAt: created,
    updatedAt: seedIso(Math.max(0, daysAgo - 1)),
    history: steps.map((s, i) => ({
      at: new Date(new Date(created).getTime() + i * 3_600_000).toISOString(),
      status: s,
      byId: s === "created" ? sellerId : "u-founder",
      note: s === "created" ? "Заявка создана." : s === "rejected" ? comment : s === "paid" ? "Тестовая выплата отмечена (реальный перевод не выполнялся)." : "",
    })),
  };
};

export const seedPayouts: PayoutRequest[] = [
  mkPayout(1, "u-jasur", 300_000, "paid", 6, "Тестовая выплата (демо)."),
  mkPayout(2, "u-jasur", 150_000, "created", 1, ""),
  mkPayout(3, "u-timur", 500_000, "in_review", 2, "Проверяем реквизиты (демо)."),
  mkPayout(4, "u-dilya", 100_000, "rejected", 3, "Реквизиты не заполнены корректно (демо)."),
];

function ledgerFromPayouts(payouts: PayoutRequest[]): LedgerEntry[] {
  const out: LedgerEntry[] = [];
  for (const p of payouts) {
    out.push(onPayoutRequested(p, p.history[0].at));
    const last = p.history[p.history.length - 1];
    if (p.status === "paid") out.push(onPayoutPaid(p, last.at));
    if (p.status === "rejected") out.push(onPayoutRejected(p, last.at));
  }
  return out;
}

export const seedLedger: LedgerEntry[] = [...ledgerFromOrders(seedOrders), ...ledgerFromPayouts(seedPayouts)]
  .sort((a, b) => a.at.localeCompare(b.at))
  .map((e, i) => ({ ...e, id: `le-seed-${i + 1}` }));

export const seedAudit: AuditEntry[] = [
  { id: "au-seed-1", at: seedIso(6), actorId: "u-founder", action: "payout.paid", entity: "payout", entityId: "p-seed-1", detail: "PAY-7001: тестовая выплата отмечена выполненной" },
  { id: "au-seed-2", at: seedIso(3), actorId: "u-founder", action: "payout.rejected", entity: "payout", entityId: "p-seed-4", detail: "PAY-7004: заявка отклонена" },
  { id: "au-seed-3", at: seedIso(11), actorId: "u-founder", action: "order.refunded", entity: "order", entityId: "o-seed-18", detail: "UZM-100218: тестовый возврат" },
  { id: "au-seed-4", at: seedIso(20), actorId: "u-founder", action: "commission.game_percent", entity: "settings", entityId: "cs2", detail: "Ставка для CS2: 6%" },
];
