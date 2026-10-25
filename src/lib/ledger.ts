import type { LedgerEntry, LedgerKind, Order, PayoutRequest } from "@/lib/types";

/**
 * Финансовый журнал (леджер) — ТЕСТОВЫЙ (DEMO): реальные деньги не учитываются.
 * Баланс продавца = сумма дельт по его записям. Записи не редактируются, только добавляются.
 *
 *   pending   — оплачено покупателем, заказ ещё не завершён
 *   available — заказ завершён, можно запросить выплату
 *   inPayout  — заявка на вывод создана/в обработке
 *   paid      — выплачено (в демо — условно)
 *
 * Идемпотентность: по одному заказу каждый вид записи (оплата / завершение / возврат)
 * может появиться только один раз — повторная обработка события ничего не меняет.
 */

export interface Balance {
  pending: number;
  available: number;
  inPayout: number;
  paid: number;
  /** Комиссия платформы, удержанная с продавца по завершённым сделкам (сумма platformFee). */
  platformFee: number;
}

export const EMPTY_BALANCE: Balance = { pending: 0, available: 0, inPayout: 0, paid: 0, platformFee: 0 };

let seq = 0;
function lid(): string {
  seq += 1;
  const rnd =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `le-${rnd}${seq}`;
}

function entry(
  kind: LedgerKind,
  userId: string,
  at: string,
  note: string,
  d: Partial<Pick<LedgerEntry, "pending" | "available" | "inPayout" | "paid" | "platformFee">>,
  ref: { orderId?: string; payoutId?: string } = {},
): LedgerEntry {
  return { id: lid(), at, userId, kind, pending: 0, available: 0, inPayout: 0, paid: 0, platformFee: 0, note, ...d, ...ref };
}

export function hasEntry(ledger: LedgerEntry[], kind: LedgerKind, ref: { orderId?: string; payoutId?: string }): boolean {
  return ledger.some(
    (e) => e.kind === kind && (ref.orderId ? e.orderId === ref.orderId : true) && (ref.payoutId ? e.payoutId === ref.payoutId : true),
  );
}

/** Оплата прошла: доход продавца (после комиссии) ожидает завершения заказа. */
export function onOrderPaid(order: Order, at: string): LedgerEntry {
  return entry("order_paid", order.sellerId, at, `Заказ ${order.number} оплачен (тест): доход ожидает завершения.`, { pending: order.commission.sellerNetUzs }, { orderId: order.id });
}

/** Заказ завершён: доход становится доступным к выплате, комиссия платформы признаётся. */
export function onOrderCompleted(order: Order, at: string): LedgerEntry {
  return entry(
    "order_released",
    order.sellerId,
    at,
    `Заказ ${order.number} завершён: доход доступен к выплате, комиссия платформы ${order.commission.feeUzs.toLocaleString("ru-RU")} сум.`,
    { pending: -order.commission.sellerNetUzs, available: order.commission.sellerNetUzs, platformFee: order.commission.feeUzs },
    { orderId: order.id },
  );
}

/** Возврат или отмена после оплаты: ожидаемый доход снимается. */
export function onOrderReversed(order: Order, at: string): LedgerEntry {
  return entry("order_reversed", order.sellerId, at, `Заказ ${order.number}: оплата возвращена покупателю (тест), доход снят.`, { pending: -order.commission.sellerNetUzs }, { orderId: order.id });
}

export function onPayoutRequested(p: PayoutRequest, at: string): LedgerEntry {
  return entry("payout_requested", p.sellerId, at, `Заявка ${p.number} на вывод (тест).`, { available: -p.amountUzs, inPayout: p.amountUzs }, { payoutId: p.id });
}
export function onPayoutPaid(p: PayoutRequest, at: string): LedgerEntry {
  return entry("payout_paid", p.sellerId, at, `Заявка ${p.number}: тестовая выплата отмечена выполненной (реальный перевод не выполнялся).`, { inPayout: -p.amountUzs, paid: p.amountUzs }, { payoutId: p.id });
}
export function onPayoutRejected(p: PayoutRequest, at: string): LedgerEntry {
  return entry("payout_rejected", p.sellerId, at, `Заявка ${p.number} отклонена: сумма возвращена в «Доступно».`, { inPayout: -p.amountUzs, available: p.amountUzs }, { payoutId: p.id });
}

export function balanceOf(ledger: LedgerEntry[], userId: string): Balance {
  const b = { ...EMPTY_BALANCE };
  for (const e of ledger) {
    if (e.userId !== userId) continue;
    b.pending += e.pending;
    b.available += e.available;
    b.inPayout += e.inPayout;
    b.paid += e.paid;
    b.platformFee += e.platformFee;
  }
  return b;
}

export function isNonNegative(b: Balance): boolean {
  return b.pending >= 0 && b.available >= 0 && b.inPayout >= 0 && b.paid >= 0;
}

export type Period = "day" | "week" | "month" | "all";
const PERIOD_MS: Record<Exclude<Period, "all">, number> = { day: 86_400_000, week: 7 * 86_400_000, month: 30 * 86_400_000 };

export function platformRevenue(ledger: LedgerEntry[], period: Period, now: Date): number {
  const from = period === "all" ? -Infinity : now.getTime() - PERIOD_MS[period];
  let sum = 0;
  for (const e of ledger) if (e.platformFee !== 0 && new Date(e.at).getTime() >= from) sum += e.platformFee;
  return sum;
}
