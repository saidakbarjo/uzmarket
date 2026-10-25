import { describe, expect, it } from "vitest";
import { DEFAULT_COMMISSION, calcCommission } from "@/lib/commission";
import { balanceOf, hasEntry, isNonNegative, onOrderCompleted, onOrderPaid, onOrderReversed, onPayoutPaid, onPayoutRejected, onPayoutRequested, platformRevenue } from "@/lib/ledger";
import { applyPayoutStatus, availablePayoutActions, looksLikeRealAccountNumber, nextPayoutStatus } from "@/lib/payouts";
import { seedLedger, seedOrders, seedPayouts } from "@/lib/data/seed-orders";
import { seedProfiles, SEED_NOW } from "@/lib/data/seed";
import type { Order, PayoutRequest } from "@/lib/types";

const order = (price = 100_000): Order => ({
  id: "o1", number: "UZM-1", listingId: "l", listingTitle: "t", gameSlug: "cs2", buyerId: "b", sellerId: "s",
  unitPriceUzs: price, quantity: 1, priceUzs: price,
  commission: calcCommission(price, DEFAULT_COMMISSION, { gameSlug: "cs2", sellerId: "s" }),
  status: "paid", createdAt: "", updatedAt: "", events: [], messages: [], isDemo: true,
});
const T = "2026-10-24T10:00:00Z";
const payout = (amount: number): PayoutRequest => ({
  id: "p1", number: "PAY-1", sellerId: "s", amountUzs: amount, method: "card_demo", details: "тест", status: "created",
  adminComment: "", createdAt: T, updatedAt: T, history: [],
});

describe("леджер продавца", () => {
  it("оплата → ожидает; завершение → доступно + комиссия платформы", () => {
    const o = order();
    let l = [onOrderPaid(o, T)];
    expect(balanceOf(l, "s")).toMatchObject({ pending: 95_000, available: 0, platformFee: 0 });
    l = [...l, onOrderCompleted(o, T)];
    expect(balanceOf(l, "s")).toMatchObject({ pending: 0, available: 95_000, platformFee: 5_000 });
    expect(platformRevenue(l, "all", new Date(T))).toBe(5_000);
  });

  it("возврат после оплаты снимает ожидаемый доход, комиссия платформы не начисляется", () => {
    const o = order();
    const l = [onOrderPaid(o, T), onOrderReversed(o, T)];
    expect(balanceOf(l, "s")).toMatchObject({ pending: 0, available: 0, platformFee: 0 });
    expect(platformRevenue(l, "all", new Date(T))).toBe(0);
  });

  it("идемпотентность: hasEntry обнаруживает уже проведённую запись", () => {
    const o = order();
    const l = [onOrderPaid(o, T)];
    expect(hasEntry(l, "order_paid", { orderId: "o1" })).toBe(true);
    expect(hasEntry(l, "order_released", { orderId: "o1" })).toBe(false);
  });

  it("жизненный цикл выплаты: запрос → выплачено / отклонено", () => {
    const o = order(1_000_000);
    const p = payout(400_000);
    const base = [onOrderPaid(o, T), onOrderCompleted(o, T)];
    const req = [...base, onPayoutRequested(p, T)];
    expect(balanceOf(req, "s")).toMatchObject({ available: 550_000, inPayout: 400_000, paid: 0 });
    expect(balanceOf([...req, onPayoutPaid(p, T)], "s")).toMatchObject({ available: 550_000, inPayout: 0, paid: 400_000 });
    expect(balanceOf([...req, onPayoutRejected(p, T)], "s")).toMatchObject({ available: 950_000, inPayout: 0, paid: 0 });
  });

  it("периоды дохода платформы: день / неделя / месяц", () => {
    const now = new Date("2026-10-24T12:00:00Z");
    const mk = (iso: string) => onOrderCompleted(order(), iso);
    const l = [mk("2026-10-24T08:00:00Z"), mk("2026-10-20T08:00:00Z"), mk("2026-10-01T08:00:00Z"), mk("2026-08-01T08:00:00Z")];
    expect(platformRevenue(l, "day", now)).toBe(5_000);
    expect(platformRevenue(l, "week", now)).toBe(10_000);
    expect(platformRevenue(l, "month", now)).toBe(15_000);
    expect(platformRevenue(l, "all", now)).toBe(20_000);
  });
});

describe("заявки на вывод", () => {
  it("допустимые переходы статусов", () => {
    expect(nextPayoutStatus("created", "review")).toBe("in_review");
    expect(nextPayoutStatus("in_review", "approve")).toBe("approved");
    expect(nextPayoutStatus("approved", "mark_paid")).toBe("paid");
    expect(() => nextPayoutStatus("created", "mark_paid")).toThrow(); // нельзя «выплатить» без одобрения
    expect(() => nextPayoutStatus("paid", "reject")).toThrow(); // выплаченную нельзя отклонить
    expect(() => nextPayoutStatus("rejected", "approve")).toThrow();
    expect(availablePayoutActions("paid")).toEqual([]);
  });

  it("applyPayoutStatus пишет историю и комментарий", () => {
    const p = applyPayoutStatus(payout(100_000), "review", "admin", "Проверяем", new Date(T));
    expect(p.status).toBe("in_review");
    expect(p.adminComment).toBe("Проверяем");
    expect(p.history).toHaveLength(1);
  });

  it("не принимает похожие на реальные номера карт", () => {
    expect(looksLikeRealAccountNumber("8600 1234 5678 9012")).toBe(true);
    expect(looksLikeRealAccountNumber("86001234567890123")).toBe(true);
    expect(looksLikeRealAccountNumber("Тестовая карта (демо)")).toBe(false);
  });
});

describe("согласованность тестовых данных", () => {
  it("у всех продавцов балансы неотрицательны, сумма заявок не превышает заработанное", () => {
    for (const p of seedProfiles.filter((x) => x.isSeller)) {
      const b = balanceOf(seedLedger, p.id);
      expect(isNonNegative(b), p.username).toBe(true);
    }
    expect(seedPayouts.length).toBeGreaterThan(0);
  });

  it("комиссия платформы в леджере равна сумме комиссий завершённых заказов", () => {
    const fromOrders = seedOrders.filter((o) => o.status === "completed").reduce((s, o) => s + o.commission.feeUzs, 0);
    expect(platformRevenue(seedLedger, "all", new Date(SEED_NOW))).toBe(fromOrders);
  });

  it("в каждом заказе: итого − доход продавца = комиссия", () => {
    for (const o of seedOrders) expect(o.commission.totalUzs - o.commission.sellerNetUzs).toBe(o.commission.feeUzs);
  });
});
