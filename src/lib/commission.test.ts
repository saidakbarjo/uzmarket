import { describe, expect, it } from "vitest";
import { DEFAULT_COMMISSION, calcCommission, checkOrderLimits, resolvePercent, type CommissionSettings } from "@/lib/commission";

const ctx = { gameSlug: "cs2", sellerId: "s1" };
const base: CommissionSettings = { ...DEFAULT_COMMISSION, defaultPercent: 5 };

describe("расчёт комиссии", () => {
  it("пример из ТЗ: 100 000 сум → комиссия 5 000, доход продавца 95 000", () => {
    const c = calcCommission(100_000, base, ctx);
    expect(c.feeUzs).toBe(5_000);
    expect(c.sellerNetUzs).toBe(95_000);
    expect(c.totalUzs).toBe(100_000);
    expect(c.buyerFeeUzs).toBe(0);
    expect(c.sellerFeeUzs).toBe(5_000);
  });

  it("округляет комиссию вверх до целого сума и не использует float", () => {
    const c = calcCommission(33_333, base, ctx);
    expect(c.feeUzs).toBe(1_667); // 1666.65 → 1667
    expect(Number.isInteger(c.feeUzs) && Number.isInteger(c.sellerNetUzs)).toBe(true);
  });

  it("поддерживает дробный процент (2,5%) точно", () => {
    expect(calcCommission(100_000, { ...base, defaultPercent: 2.5 }, ctx).feeUzs).toBe(2_500);
    expect(calcCommission(40_000, { ...base, defaultPercent: 0.1 }, ctx).feeUzs).toBe(40);
  });

  it("приоритет ставок: продавец > игра > общая", () => {
    const s: CommissionSettings = { ...base, gamePercent: { cs2: 7 }, sellerPercent: { s1: 3 } };
    expect(resolvePercent(s, "cs2", "s1")).toEqual({ percent: 3, source: "seller" });
    expect(resolvePercent(s, "cs2", "other")).toEqual({ percent: 7, source: "game" });
    expect(resolvePercent(s, "valorant", "other")).toEqual({ percent: 5, source: "default" });
    expect(calcCommission(100_000, s, ctx).feeUzs).toBe(3_000);
  });

  it("ставка 0% допустима и означает отсутствие комиссии", () => {
    const c = calcCommission(100_000, { ...base, sellerPercent: { s1: 0 } }, ctx);
    expect(c.feeUzs).toBe(0);
    expect(c.sellerNetUzs).toBe(100_000);
  });

  it("минимальная комиссия, если включена, и она не превышает стоимость товара", () => {
    const s = { ...base, minFeeEnabled: true, minFeeUzs: 2_000 };
    const c = calcCommission(10_000, s, ctx); // 5% = 500 → поднимается до 2000
    expect(c.feeUzs).toBe(2_000);
    expect(c.minFeeApplied).toBe(true);
    expect(calcCommission(1_500, s, ctx).feeUzs).toBe(1_500);
    expect(calcCommission(100_000, s, ctx).minFeeApplied).toBe(false);
  });

  it("плательщик: продавец / покупатель / пополам", () => {
    const seller = calcCommission(100_000, { ...base, payer: "seller" }, ctx);
    const buyer = calcCommission(100_000, { ...base, payer: "buyer" }, ctx);
    const split = calcCommission(100_001, { ...base, payer: "split" }, ctx);
    expect([seller.totalUzs, seller.sellerNetUzs]).toEqual([100_000, 95_000]);
    expect([buyer.totalUzs, buyer.sellerNetUzs]).toEqual([105_000, 100_000]);
    expect(split.feeUzs).toBe(5_001);
    expect(split.buyerFeeUzs + split.sellerFeeUzs).toBe(split.feeUzs);
    expect(split.buyerFeeUzs).toBe(2_500);
  });

  it("всегда: итого покупателя − доход продавца = комиссия платформы", () => {
    for (const payer of ["seller", "buyer", "split"] as const) {
      for (const price of [1_000, 1_999, 33_333, 100_000, 1_850_000, 49_999_999]) {
        const c = calcCommission(price, { ...base, payer, defaultPercent: 6.5 }, ctx);
        expect(c.totalUzs - c.sellerNetUzs).toBe(c.feeUzs);
        expect(c.sellerNetUzs).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("отклоняет некорректные значения", () => {
    expect(() => calcCommission(-1, base, ctx)).toThrow();
    expect(() => calcCommission(100.5, base, ctx)).toThrow();
    expect(() => calcCommission(1000, { ...base, defaultPercent: 80 }, ctx)).toThrow();
  });

  it("лимиты суммы заказа", () => {
    const s = { ...base, minOrderUzs: 5_000, maxOrderUzs: 1_000_000 };
    expect(checkOrderLimits(4_999, s)).toMatch(/Минимальная/);
    expect(checkOrderLimits(1_000_001, s)).toMatch(/Максимальная/);
    expect(checkOrderLimits(5_000, s)).toBeNull();
    expect(checkOrderLimits(0, s)).not.toBeNull();
  });
});
