import type { Commission, FeePayer } from "@/lib/types";

/**
 * Расчёт комиссии платформы. Чистая целочисленная арифметика (сумы), без float.
 * Проценты хранятся в сотых долях процента (basis points), чтобы 2,5% считалось точно.
 *
 * ВАЖНО: комиссия считается ТОЛЬКО на сервере/в хранилище по сохранённым настройкам
 * и фиксируется в заказе. Значения из браузера (цена, процент, сумма) не принимаются.
 */

export interface CommissionSettings {
  defaultPercent: number; // 0..50
  gamePercent: Record<string, number>; // особые проценты для игр
  sellerPercent: Record<string, number>; // особые проценты для продавцов
  minFeeEnabled: boolean;
  minFeeUzs: number;
  payer: FeePayer;
  minOrderUzs: number;
  maxOrderUzs: number;
}

export const MAX_COMMISSION_PERCENT = 50;

export const DEFAULT_COMMISSION: CommissionSettings = {
  defaultPercent: 5, // демонстрационная комиссия
  gamePercent: {},
  sellerPercent: {},
  minFeeEnabled: false,
  minFeeUzs: 1000,
  payer: "seller",
  minOrderUzs: 1000,
  maxOrderUzs: 50_000_000,
};

const toBp = (percent: number) => Math.round(percent * 100);

export function resolvePercent(
  s: CommissionSettings,
  gameSlug: string,
  sellerId: string,
): { percent: number; source: Commission["source"] } {
  // приоритет: индивидуальная ставка продавца → ставка игры → общая
  if (Object.prototype.hasOwnProperty.call(s.sellerPercent, sellerId)) return { percent: s.sellerPercent[sellerId], source: "seller" };
  if (Object.prototype.hasOwnProperty.call(s.gamePercent, gameSlug)) return { percent: s.gamePercent[gameSlug], source: "game" };
  return { percent: s.defaultPercent, source: "default" };
}

/** Проверка лимитов суммы заказа. Возвращает текст ошибки или null. */
export function checkOrderLimits(subtotalUzs: number, s: CommissionSettings): string | null {
  if (!Number.isInteger(subtotalUzs) || subtotalUzs <= 0) return "Некорректная сумма заказа";
  if (subtotalUzs < s.minOrderUzs) return `Минимальная сумма заказа — ${s.minOrderUzs.toLocaleString("ru-RU")} сум`;
  if (subtotalUzs > s.maxOrderUzs) return `Максимальная сумма заказа — ${s.maxOrderUzs.toLocaleString("ru-RU")} сум`;
  return null;
}

export function calcCommission(
  subtotalUzs: number,
  s: CommissionSettings,
  ctx: { gameSlug: string; sellerId: string },
): Commission {
  if (!Number.isInteger(subtotalUzs) || subtotalUzs < 0) throw new Error("Некорректная сумма");
  const { percent, source } = resolvePercent(s, ctx.gameSlug, ctx.sellerId);
  if (!(percent >= 0 && percent <= MAX_COMMISSION_PERCENT)) throw new Error("Некорректный процент комиссии");

  let fee = Math.ceil((subtotalUzs * toBp(percent)) / 10_000);
  let minFeeApplied = false;
  if (s.minFeeEnabled && fee < s.minFeeUzs) {
    fee = s.minFeeUzs;
    minFeeApplied = true;
  }
  fee = Math.min(fee, subtotalUzs); // комиссия никогда не больше стоимости товара

  let buyerFee = 0;
  if (s.payer === "buyer") buyerFee = fee;
  else if (s.payer === "split") buyerFee = Math.floor(fee / 2);
  const sellerFee = fee - buyerFee;

  return {
    percent,
    source,
    payer: s.payer,
    feeUzs: fee,
    buyerFeeUzs: buyerFee,
    sellerFeeUzs: sellerFee,
    totalUzs: subtotalUzs + buyerFee,
    sellerNetUzs: subtotalUzs - sellerFee,
    minFeeApplied,
  };
}

export const PAYER_LABELS: Record<FeePayer, string> = {
  seller: "Продавец",
  buyer: "Покупатель",
  split: "Пополам",
};

export const SOURCE_LABELS: Record<Commission["source"], string> = {
  seller: "индивидуальная ставка продавца",
  game: "ставка для игры",
  default: "общая ставка",
};
