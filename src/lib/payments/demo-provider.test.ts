import { describe, expect, it } from "vitest";
import { DemoPaymentProvider, makeEvent } from "@/lib/payments/demo-provider";

const p = new DemoPaymentProvider();
const base = { orderId: "o1", amountUzs: 100_000, feeUzs: 5_000, idempotencyKey: "o1:pay:1" };

describe("DemoPaymentProvider", () => {
  it("успешная тестовая оплата", () => {
    const intent = p.createIntent(base);
    const res = p.handleEvent(intent, makeEvent(intent.id, "payment.succeeded"), new Set());
    expect(res.applied).toBe(true);
    expect(res.intent.status).toBe("succeeded");
  });

  it("неуспешная оплата и отмена", () => {
    const a = p.createIntent(base);
    expect(p.handleEvent(a, makeEvent(a.id, "payment.failed"), new Set()).intent.status).toBe("failed");
    const b = p.createIntent(base);
    expect(p.handleEvent(b, makeEvent(b.id, "payment.cancelled"), new Set()).intent.status).toBe("cancelled");
  });

  it("повторное уведомление игнорируется (идемпотентность)", () => {
    const intent = p.createIntent(base);
    const ev = makeEvent(intent.id, "payment.succeeded", "evt_fixed");
    const first = p.handleEvent(intent, ev, new Set());
    expect(first.applied).toBe(true);
    const replay = p.handleEvent(first.intent, ev, new Set(["evt_fixed"]));
    expect(replay.applied).toBe(false);
    expect(replay.intent.status).toBe("succeeded");
  });

  it("новое событие того же типа не применяется к уже оплаченному платежу", () => {
    const intent = p.createIntent(base);
    const paid = p.handleEvent(intent, makeEvent(intent.id, "payment.succeeded"), new Set()).intent;
    expect(p.handleEvent(paid, makeEvent(paid.id, "payment.failed"), new Set()).applied).toBe(false);
  });

  it("возврат только для успешного платежа", () => {
    const intent = p.createIntent(base);
    expect(() => p.refund(intent)).toThrow();
    const paid = p.handleEvent(intent, makeEvent(intent.id, "payment.succeeded"), new Set()).intent;
    expect(p.refund(paid).status).toBe("refunded");
  });

  it("событие чужого платежа не применяется", () => {
    const intent = p.createIntent(base);
    expect(p.handleEvent(intent, makeEvent("pi_other", "payment.succeeded"), new Set()).applied).toBe(false);
  });

  it("сумма должна быть целым положительным числом", () => {
    expect(() => p.createIntent({ ...base, amountUzs: 10.5 })).toThrow();
    expect(() => p.createIntent({ ...base, amountUzs: -1 })).toThrow();
  });

  it("демо-провайдер явно помечен как демо", () => {
    expect(p.isDemo).toBe(true);
    expect(p.verifyWebhook("{}", null)).toBe(false);
  });
});
