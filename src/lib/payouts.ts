import { DomainError } from "@/lib/orders-domain";
import type { PayoutMethod, PayoutRequest, PayoutStatus } from "@/lib/types";

/**
 * Заявки на вывод средств. ТЕСТОВЫЙ режим: никакие деньги не переводятся.
 * Статус «Выплачена» — это только отметка администратора в демо, а не подтверждение перевода.
 * Продавец не может менять статус заявки: это делает только администратор.
 */

export const MIN_PAYOUT_UZS = 50_000;

export const PAYOUT_METHOD_LABELS: Record<PayoutMethod, string> = {
  card_demo: "Карта (тестовый способ)",
  bank_demo: "Банковский перевод (тестовый способ)",
  wallet_future: "Электронный кошелёк (будет после подключения провайдера)",
};

export const PAYOUT_STATUS_LABELS: Record<PayoutStatus, string> = {
  created: "Создана",
  in_review: "На проверке",
  approved: "Одобрена",
  paid: "Выплачена (тест)",
  rejected: "Отклонена",
};

export type PayoutAction = "review" | "approve" | "mark_paid" | "reject";

const TRANSITIONS: Record<PayoutAction, { from: PayoutStatus[]; to: PayoutStatus }> = {
  review: { from: ["created"], to: "in_review" },
  approve: { from: ["created", "in_review"], to: "approved" },
  mark_paid: { from: ["approved"], to: "paid" },
  reject: { from: ["created", "in_review", "approved"], to: "rejected" },
};

export function nextPayoutStatus(current: PayoutStatus, action: PayoutAction): PayoutStatus {
  const t = TRANSITIONS[action];
  if (!t.from.includes(current)) throw new DomainError("Действие недоступно в текущем статусе заявки", "invalid_state");
  return t.to;
}

export function availablePayoutActions(status: PayoutStatus): PayoutAction[] {
  return (Object.keys(TRANSITIONS) as PayoutAction[]).filter((a) => TRANSITIONS[a].from.includes(status));
}

/** Не принимаем похожие на реальные номера карт/счетов: в демо это тестовые данные. */
export function looksLikeRealAccountNumber(text: string): boolean {
  return /\d{12,}/.test(text.replace(/[\s-]/g, ""));
}

export function applyPayoutStatus(p: PayoutRequest, action: PayoutAction, byId: string, comment: string, now: Date): PayoutRequest {
  const to = nextPayoutStatus(p.status, action);
  const at = now.toISOString();
  return {
    ...p,
    status: to,
    adminComment: comment || p.adminComment,
    updatedAt: at,
    history: [...p.history, { at, status: to, byId, note: comment }],
  };
}
