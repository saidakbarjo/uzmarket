import { describe, expect, it } from "vitest";
import { DomainError, addMessage, applyAction, availableActions, canView, setFulfillmentNote } from "@/lib/orders-domain";
import type { Order } from "@/lib/types";

const buyer = { id: "buyer", role: "user" as const, blocked: false };
const seller = { id: "seller", role: "user" as const, blocked: false };
const stranger = { id: "stranger", role: "user" as const, blocked: false };
const admin = { id: "admin", role: "admin" as const, blocked: false };

function makeOrder(status: Order["status"] = "pending_payment"): Order {
  return {
    id: "o1",
    number: "UZM-1",
    listingId: "l1",
    listingTitle: "Тест",
    buyerId: "buyer",
    sellerId: "seller",
    priceUzs: 100_000,
    feeUzs: 5_000,
    status,
    createdAt: "2026-10-01T00:00:00Z",
    updatedAt: "2026-10-01T00:00:00Z",
    events: [],
    messages: [],
    isDemo: true,
  };
}

describe("orders-domain: переходы статусов", () => {
  it("полный успешный путь заказа", () => {
    let o = makeOrder();
    o = applyAction(o, "pay_success", buyer);
    expect(o.status).toBe("paid");
    o = applyAction(o, "start", seller);
    expect(o.status).toBe("in_progress");
    o = applyAction(o, "deliver", seller);
    expect(o.status).toBe("delivered");
    o = applyAction(o, "confirm", buyer);
    expect(o.status).toBe("completed");
    expect(o.events).toHaveLength(4);
  });

  it("не допускает двойного завершения заказа", () => {
    const done = applyAction(makeOrder("delivered"), "confirm", buyer);
    expect(() => applyAction(done, "confirm", buyer)).toThrowError(DomainError);
  });

  it("чужой пользователь не может подтвердить заказ", () => {
    expect(() => applyAction(makeOrder("delivered"), "confirm", stranger)).toThrowError(/Нет прав/);
  });

  it("продавец не может подтвердить получение за покупателя", () => {
    expect(() => applyAction(makeOrder("delivered"), "confirm", seller)).toThrowError(/Нет прав/);
  });

  it("покупатель не может выдавать заказ вместо продавца", () => {
    expect(() => applyAction(makeOrder("paid"), "deliver", buyer)).toThrowError(/Нет прав/);
  });

  it("нельзя подтвердить неоплаченный заказ", () => {
    expect(() => applyAction(makeOrder("pending_payment"), "confirm", buyer)).toThrowError(/статус/);
  });

  it("заблокированный пользователь не может действовать", () => {
    expect(() => applyAction(makeOrder("paid"), "start", { ...seller, blocked: true })).toThrowError(/заблокирован/);
  });

  it("цена, комиссия и стороны не меняются при переходах", () => {
    const o0 = makeOrder();
    const o1 = applyAction(o0, "pay_success", buyer);
    expect(o1.priceUzs).toBe(100_000);
    expect(o1.feeUzs).toBe(5_000);
    expect(o1.buyerId).toBe("buyer");
    expect(o1.sellerId).toBe("seller");
    expect(o0.status).toBe("pending_payment"); // исходный объект не мутирован
  });

  it("спор открывает только покупатель; возврат — только админ", () => {
    const disputed = applyAction(makeOrder("delivered"), "open_dispute", buyer);
    expect(disputed.status).toBe("disputed");
    expect(() => applyAction(makeOrder("delivered"), "open_dispute", seller)).toThrowError(/Нет прав/);
    expect(() => applyAction(disputed, "refund", buyer)).toThrowError(/Нет прав/);
    expect(applyAction(disputed, "refund", admin).status).toBe("refunded");
  });

  it("завершённый заказ нельзя ни отменить, ни вернуть", () => {
    const completed = makeOrder("completed");
    expect(() => applyAction(completed, "cancel", buyer)).toThrowError(/статус/);
    expect(() => applyAction(completed, "refund", admin)).toThrowError(/статус/);
  });
});

describe("orders-domain: доступ и сообщения", () => {
  it("видят только участники и админ", () => {
    const o = makeOrder();
    expect(canView(o, buyer)).toBe(true);
    expect(canView(o, seller)).toBe(true);
    expect(canView(o, admin)).toBe(true);
    expect(canView(o, stranger)).toBe(false);
    expect(canView(o, null)).toBe(false);
  });

  it("сообщения: посторонний не может писать, пустые и длинные отклоняются", () => {
    const o = makeOrder("paid");
    expect(() => addMessage(o, stranger, "привет")).toThrowError(/Нет доступа/);
    expect(() => addMessage(o, buyer, "   ")).toThrowError(/Некорректное/);
    expect(() => addMessage(o, buyer, "a".repeat(1001))).toThrowError(/Некорректное/);
    expect(addMessage(o, buyer, "Здравствуйте").messages).toHaveLength(1);
  });

  it("информацию о выполнении заполняет только продавец", () => {
    const o = makeOrder("in_progress");
    expect(() => setFulfillmentNote(o, buyer, "готово")).toThrowError(/Только продавец/);
    expect(setFulfillmentNote(o, seller, "Готово, проверьте").fulfillmentNote).toBe("Готово, проверьте");
  });

  it("availableActions отражает роль и статус", () => {
    expect(availableActions(makeOrder("delivered"), buyer)).toEqual(expect.arrayContaining(["confirm", "open_dispute"]));
    expect(availableActions(makeOrder("delivered"), seller)).not.toContain("confirm");
    expect(availableActions(makeOrder("delivered"), stranger)).toEqual([]);
  });
});
