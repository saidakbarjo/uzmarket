import { describe, expect, it } from "vitest";
import { calcFee, formatUZS } from "@/lib/money";
import { listingSchema, registerSchema, reviewSchema, ticketSchema } from "@/lib/validation";

const validListing = {
  title: "Логотип для бренда",
  categorySlug: "design",
  description: "Разработка логотипа: три концепции и две правки.",
  priceUzs: 350_000,
  deliveryMethod: "file",
  deliveryDays: 3,
  refundTerms: "Возврат до начала работы.",
  fulfillmentTerms: "Файлы передаются через чат заказа.",
};

describe("валидация объявления", () => {
  it("принимает корректные данные", () => {
    expect(listingSchema.safeParse(validListing).success).toBe(true);
  });

  it("запрещает отрицательную и нулевую цену", () => {
    expect(listingSchema.safeParse({ ...validListing, priceUzs: -5000 }).success).toBe(false);
    expect(listingSchema.safeParse({ ...validListing, priceUzs: 0 }).success).toBe(false);
  });

  it("запрещает дробные и слишком большие цены", () => {
    expect(listingSchema.safeParse({ ...validListing, priceUzs: 1500.5 }).success).toBe(false);
    expect(listingSchema.safeParse({ ...validListing, priceUzs: 10_000_000_000 }).success).toBe(false);
  });

  it("запрещает пустые обязательные поля и слишком длинные значения", () => {
    expect(listingSchema.safeParse({ ...validListing, title: "" }).success).toBe(false);
    expect(listingSchema.safeParse({ ...validListing, description: "коротко" }).success).toBe(false);
    expect(listingSchema.safeParse({ ...validListing, title: "я".repeat(121) }).success).toBe(false);
    expect(listingSchema.safeParse({ ...validListing, description: "я".repeat(3001) }).success).toBe(false);
  });

  it("запрещает неизвестную категорию и отрицательный срок", () => {
    expect(listingSchema.safeParse({ ...validListing, categorySlug: "weapons" }).success).toBe(false);
    expect(listingSchema.safeParse({ ...validListing, deliveryDays: -1 }).success).toBe(false);
  });
});

describe("валидация остальных форм", () => {
  it("регистрация: пароль не короче 8, e-mail корректный", () => {
    expect(registerSchema.safeParse({ username: "user_1", email: "a@b.uz", password: "12345678" }).success).toBe(true);
    expect(registerSchema.safeParse({ username: "user_1", email: "a@b.uz", password: "123" }).success).toBe(false);
    expect(registerSchema.safeParse({ username: "user_1", email: "не-почта", password: "12345678" }).success).toBe(false);
    expect(registerSchema.safeParse({ username: "<script>", email: "a@b.uz", password: "12345678" }).success).toBe(false);
  });

  it("отзыв: оценка 1–5", () => {
    expect(reviewSchema.safeParse({ rating: 5, text: "Отличная работа, спасибо!" }).success).toBe(true);
    expect(reviewSchema.safeParse({ rating: 0, text: "Отличная работа, спасибо!" }).success).toBe(false);
    expect(reviewSchema.safeParse({ rating: 6, text: "Отличная работа, спасибо!" }).success).toBe(false);
  });

  it("обращение: описание обязательно", () => {
    const t = { kind: "support", subject: "Вопрос по заказу", reason: "Другое", description: "Не могу найти информацию о выполнении." };
    expect(ticketSchema.safeParse(t).success).toBe(true);
    expect(ticketSchema.safeParse({ ...t, description: "" }).success).toBe(false);
  });
});

describe("деньги", () => {
  it("форматирует сумы с пробелами", () => {
    expect(formatUZS(1_250_000)).toBe("1 250 000 сум");
  });

  it("комиссия считается целым числом", () => {
    expect(calcFee(100_000)).toBe(5_000);
    expect(calcFee(33_333)).toBe(1_667);
    expect(Number.isInteger(calcFee(12_345))).toBe(true);
    expect(() => calcFee(-1)).toThrow();
    expect(() => calcFee(10.5)).toThrow();
  });
});
