/**
 * Контракт платёжного провайдера.
 *
 * Сейчас реализован только DemoPaymentProvider (см. demo-provider.ts) — он не обращается
 * к реальным платёжным системам и не двигает деньги.
 *
 * Будущий серверный адаптер для согласованного провайдера в Узбекистане должен:
 *  - принимать серверные уведомления (webhook) и проверять подпись (verifyWebhook);
 *  - быть идемпотентным: одно и то же событие (eventId) не обрабатывается дважды;
 *  - использовать уникальные идентификаторы операций (idempotencyKey / providerRef);
 *  - вести журнал платежей (payments, payment_events);
 *  - поддерживать возвраты, отдельный учёт комиссии и выплат продавцам (payouts).
 *
 * Законная модель удержания средств, договоры и порядок выплат согласуются отдельно
 * ДО подключения реальных денег. Демо-режим НЕ является эскроу.
 */

export type PaymentOutcome = "success" | "fail" | "cancel";

export type PaymentStatus = "created" | "succeeded" | "failed" | "cancelled" | "refunded";

export interface PaymentIntent {
  id: string;
  orderId: string;
  amountUzs: number;
  feeUzs: number;
  status: PaymentStatus;
  providerRef: string;
  idempotencyKey: string;
  createdAt: string;
}

export interface PaymentEvent {
  eventId: string; // уникален для провайдера; повтор = дубликат
  intentId: string;
  type: "payment.succeeded" | "payment.failed" | "payment.cancelled" | "payment.refunded";
  at: string;
  /** true — событие уже было обработано ранее и проигнорировано. */
  duplicate?: boolean;
}

export interface CreateIntentInput {
  orderId: string;
  amountUzs: number;
  feeUzs: number;
  idempotencyKey: string;
}

export interface PaymentProvider {
  readonly name: string;
  readonly isDemo: boolean;
  createIntent(input: CreateIntentInput): PaymentIntent;
  /** Принимает входящее событие провайдера, возвращает результат применения к платежу. */
  handleEvent(intent: PaymentIntent, event: PaymentEvent, processed: ReadonlySet<string>): {
    intent: PaymentIntent;
    applied: boolean;
  };
  /** Проверка подписи серверного уведомления (в демо — заглушка с явным признаком). */
  verifyWebhook(rawBody: string, signature: string | null): boolean;
  refund(intent: PaymentIntent): PaymentIntent;
}

export const DEMO_BANNER = "DEMO — реальные деньги не переводятся";
