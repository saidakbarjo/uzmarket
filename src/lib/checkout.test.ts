import { describe, expect, it } from "vitest";
import { DEFAULT_COMMISSION } from "@/lib/commission";
import { quote } from "@/lib/checkout";
import type { Listing } from "@/lib/types";

const l: Listing = {
  id: "l1", title: "t", description: "d", gameSlug: "cs2", productType: "item", priceUzs: 100_000, stock: 5, available: true,
  sellerId: "s1", status: "active", deliveryMethod: "chat", deliveryDays: 1, refundTerms: "", fulfillmentTerms: "", images: [],
  createdAt: "", isDemo: true, views: 0,
};

describe("расчёт заказа (quote)", () => {
  it("считает цену и комиссию на основе объявления, а не данных браузера", () => {
    const r = quote(l, 2, DEFAULT_COMMISSION);
    expect(r.ok && r.data.priceUzs).toBe(200_000);
    expect(r.ok && r.data.commission.feeUzs).toBe(10_000);
    expect(r.ok && r.data.commission.sellerNetUzs).toBe(190_000);
  });
  it("проверяет количество и остаток", () => {
    expect(quote(l, 0, DEFAULT_COMMISSION).ok).toBe(false);
    expect(quote(l, 1.5, DEFAULT_COMMISSION).ok).toBe(false);
    expect(quote(l, 6, DEFAULT_COMMISSION).ok).toBe(false);
    expect(quote({ ...l, stock: 0 }, 1, DEFAULT_COMMISSION).ok).toBe(false);
    expect(quote({ ...l, available: false }, 1, DEFAULT_COMMISSION).ok).toBe(false);
    expect(quote({ ...l, stock: null }, 50, DEFAULT_COMMISSION).ok).toBe(true);
  });
  it("не продаёт неактивные объявления и проверяет лимиты суммы", () => {
    expect(quote({ ...l, status: "pending" }, 1, DEFAULT_COMMISSION).ok).toBe(false);
    expect(quote({ ...l, status: "blocked" }, 1, DEFAULT_COMMISSION).ok).toBe(false);
    expect(quote(l, 1, { ...DEFAULT_COMMISSION, minOrderUzs: 200_000, maxOrderUzs: 1_000_000 }).ok).toBe(false);
    expect(quote(l, 5, { ...DEFAULT_COMMISSION, maxOrderUzs: 400_000 }).ok).toBe(false);
  });
});
