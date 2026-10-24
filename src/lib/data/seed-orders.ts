import { calcFee } from "@/lib/money";
import type { AppNotification, Order, OrderEvent, OrderStatus, Ticket } from "@/lib/types";
import { seedListings } from "@/lib/data/seed";

const BASE = new Date("2026-10-01T09:00:00Z").getTime();
const at = (hoursAgo: number) => new Date(BASE - hoursAgo * 3_600_000).toISOString();

function order(
  n: number,
  listingId: string,
  buyerId: string,
  status: OrderStatus,
  timeline: [OrderStatus, number, string, string | "system"][],
  extra: Partial<Order> = {},
): Order {
  const l = seedListings.find((x) => x.id === listingId)!;
  const events: OrderEvent[] = timeline.map(([st, h, note, actor], i) => ({
    id: `ev-seed-${n}-${i}`,
    at: at(h),
    status: st,
    actorId: actor,
    note,
  }));
  return {
    id: `o-seed-${n}`,
    number: `UZM-${100200 + n}`,
    listingId,
    listingTitle: l.title,
    buyerId,
    sellerId: l.sellerId,
    priceUzs: l.priceUzs,
    feeUzs: calcFee(l.priceUzs),
    status,
    createdAt: events[0].at,
    updatedAt: events[events.length - 1].at,
    events,
    messages: [
      { id: `m-seed-${n}-0`, at: at(timeline[0][1] - 1), authorId: l.sellerId, text: "Здравствуйте! Это тестовый заказ демо-режима. Напишите ваш ID, и я начну." },
    ],
    isDemo: true,
    ...extra,
  };
}

const DEMO_PAY = "Тестовая оплата прошла (DEMO — реальные деньги не переводятся).";

export const seedOrders: Order[] = [
  order(1, "l-001", "u-timur", "completed", [
    ["pending_payment", 120, "Заказ создан.", "u-timur"],
    ["paid", 119, DEMO_PAY, "u-timur"],
    ["delivered", 118, "Продавец отметил заказ как выданный.", "u-nur"],
    ["completed", 117, "Покупатель подтвердил получение. Заказ завершён.", "u-timur"],
  ], { fulfillmentNote: "Пополнение выполнено по игровому ID. Скриншот баланса отправлен в чат." }),
  order(2, "l-002", "u-timur", "in_progress", [
    ["pending_payment", 30, "Заказ создан.", "u-timur"],
    ["paid", 29, DEMO_PAY, "u-timur"],
    ["in_progress", 28, "Продавец приступил к выполнению.", "u-nur"],
  ]),
  order(3, "l-003", "u-aziza", "delivered", [
    ["pending_payment", 70, "Заказ создан.", "u-aziza"],
    ["paid", 69, DEMO_PAY, "u-aziza"],
    ["in_progress", 66, "Продавец приступил к выполнению.", "u-bek"],
    ["delivered", 8, "Продавец отметил заказ как выданный.", "u-bek"],
  ], { fulfillmentNote: "Ранг повышен на один дивизион. Запись матчей доступна по ссылке в чате." }),
  order(4, "l-004", "u-jasur", "disputed", [
    ["pending_payment", 90, "Заказ создан.", "u-jasur"],
    ["paid", 89, DEMO_PAY, "u-jasur"],
    ["delivered", 60, "Продавец отметил заказ как выданный.", "u-bek"],
    ["disputed", 40, "Покупатель открыл спор.", "u-jasur"],
  ]),
  order(5, "l-014", "u-nur", "paid", [
    ["pending_payment", 6, "Заказ создан.", "u-nur"],
    ["paid", 5, DEMO_PAY, "u-nur"],
  ]),
];

export const seedTickets: Ticket[] = [
  {
    id: "t-seed-1",
    number: "TCK-5001",
    kind: "dispute",
    authorId: "u-jasur",
    orderId: "o-seed-4",
    subject: "Спор по заказу UZM-100204: разбор не соответствует описанию",
    reason: "Товар не соответствует описанию",
    description: "Тестовый спор демо-режима: покупатель считает, что видео-разбор короче заявленных 30 минут. Это пример для проверки интерфейса.",
    evidence: "Тестовое доказательство: ссылка на файл (демо).",
    status: "in_review",
    createdAt: at(40),
    updatedAt: at(30),
    replies: [
      { id: "tr-seed-1", at: at(30), authorId: "staff", text: "Тестовый ответ поддержки: запросили у продавца исходный файл. Автоматический возврат денег не обещается — решение принимается после проверки." },
    ],
  },
];

export const seedNotifications: AppNotification[] = [
  { id: "n-seed-1", userId: "u-nur", text: "Новый тестовый заказ UZM-100205: оплачен, ожидает выполнения.", at: at(5), read: false, href: "/orders/o-seed-5" },
  { id: "n-seed-2", userId: "u-bek", text: "По заказу UZM-100204 открыт спор.", at: at(40), read: false, href: "/orders/o-seed-4" },
];
