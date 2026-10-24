import {
  type CreateIntentInput,
  type PaymentEvent,
  type PaymentIntent,
  type PaymentProvider,
} from "@/lib/payments/provider";

function uid(prefix: string): string {
  const rnd =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 12)
      : Math.random().toString(36).slice(2, 14);
  return `${prefix}_${rnd}`;
}

export class DemoPaymentProvider implements PaymentProvider {
  readonly name = "demo";
  readonly isDemo = true;

  createIntent(input: CreateIntentInput): PaymentIntent {
    if (!Number.isInteger(input.amountUzs) || input.amountUzs <= 0) {
      throw new Error("Некорректная сумма платежа");
    }
    return {
      id: uid("pi"),
      orderId: input.orderId,
      amountUzs: input.amountUzs,
      feeUzs: input.feeUzs,
      status: "created",
      providerRef: uid("demo"),
      idempotencyKey: input.idempotencyKey,
      createdAt: new Date().toISOString(),
    };
  }

  handleEvent(
    intent: PaymentIntent,
    event: PaymentEvent,
    processed: ReadonlySet<string>,
  ): { intent: PaymentIntent; applied: boolean } {
    // Идемпотентность: повторное уведомление с тем же eventId ничего не меняет.
    if (processed.has(event.eventId)) return { intent, applied: false };
    if (event.intentId !== intent.id) return { intent, applied: false };

    const next = { ...intent };
    switch (event.type) {
      case "payment.succeeded":
        if (intent.status !== "created") return { intent, applied: false };
        next.status = "succeeded";
        break;
      case "payment.failed":
        if (intent.status !== "created") return { intent, applied: false };
        next.status = "failed";
        break;
      case "payment.cancelled":
        if (intent.status !== "created") return { intent, applied: false };
        next.status = "cancelled";
        break;
      case "payment.refunded":
        if (intent.status !== "succeeded") return { intent, applied: false };
        next.status = "refunded";
        break;
    }
    return { intent: next, applied: true };
  }

  verifyWebhook(_rawBody: string, signature: string | null): boolean {
    // Демо: подписи нет. Реальный адаптер ОБЯЗАН проверять HMAC/сертификат провайдера.
    return signature === "demo-signature";
  }

  refund(intent: PaymentIntent): PaymentIntent {
    if (intent.status !== "succeeded") throw new Error("Возврат возможен только для успешного тестового платежа");
    return { ...intent, status: "refunded" };
  }
}

export const demoPayments = new DemoPaymentProvider();

export function makeEvent(
  intentId: string,
  type: PaymentEvent["type"],
  eventId: string = uid("evt"),
): PaymentEvent {
  return { eventId, intentId, type, at: new Date().toISOString() };
}
