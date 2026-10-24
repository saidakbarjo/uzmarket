import { z } from "zod";

export const MAX_PRICE_UZS = 500_000_000;

export const categorySlugSchema = z.enum([
  "game-items",
  "game-currency",
  "game-services",
  "keys",
  "software",
  "subscriptions",
  "accounts",
  "design",
  "other",
]);

export const listingSchema = z.object({
  title: z
    .string()
    .trim()
    .min(5, "Название — минимум 5 символов")
    .max(120, "Название — максимум 120 символов"),
  categorySlug: categorySlugSchema,
  description: z
    .string()
    .trim()
    .min(20, "Описание — минимум 20 символов")
    .max(3000, "Описание — максимум 3000 символов"),
  priceUzs: z
    .number({ error: "Укажите цену числом" })
    .int("Цена должна быть целым числом сумов")
    .min(1000, "Минимальная цена — 1 000 сум")
    .max(MAX_PRICE_UZS, "Цена слишком велика"),
  deliveryMethod: z.enum(["chat", "key", "manual", "file"]),
  deliveryDays: z
    .number({ error: "Укажите срок числом" })
    .int("Срок — целое число дней")
    .min(0, "Срок не может быть отрицательным")
    .max(60, "Срок — не более 60 дней"),
  refundTerms: z
    .string()
    .trim()
    .min(10, "Опишите условия возврата (минимум 10 символов)")
    .max(1000, "Условия возврата — максимум 1000 символов"),
  fulfillmentTerms: z
    .string()
    .trim()
    .min(10, "Опишите условия выполнения (минимум 10 символов)")
    .max(1000, "Условия выполнения — максимум 1000 символов"),
  imageHue: z.number().int().min(0).max(359).optional(),
});
export type ListingInput = z.infer<typeof listingSchema>;

export const registerSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "Имя — минимум 3 символа")
    .max(24, "Имя — максимум 24 символа")
    .regex(/^[\p{L}\p{N}_.-]+$/u, "Допустимы буквы, цифры, _ . -"),
  email: z.string().trim().toLowerCase().email("Некорректный e-mail").max(120),
  password: z.string().min(8, "Пароль — минимум 8 символов").max(100),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Некорректный e-mail"),
  password: z.string().min(1, "Введите пароль"),
});

export const recoverySchema = z.object({
  email: z.string().trim().toLowerCase().email("Некорректный e-mail"),
});

export const reviewSchema = z.object({
  rating: z.number().int().min(1, "Оценка от 1 до 5").max(5, "Оценка от 1 до 5"),
  text: z
    .string()
    .trim()
    .min(10, "Отзыв — минимум 10 символов")
    .max(1000, "Отзыв — максимум 1000 символов"),
});

export const ticketSchema = z.object({
  kind: z.enum(["support", "dispute", "complaint"]),
  subject: z.string().trim().min(5, "Тема — минимум 5 символов").max(120),
  reason: z.string().trim().min(3, "Укажите причину").max(120),
  description: z
    .string()
    .trim()
    .min(20, "Опишите проблему подробнее (минимум 20 символов)")
    .max(3000),
  evidence: z.string().trim().max(2000, "Слишком длинное поле").default(""),
  orderId: z.string().optional(),
});

export const messageSchema = z.object({
  text: z.string().trim().min(1, "Пустое сообщение").max(1000, "Максимум 1000 символов"),
});

export type FieldErrors = Record<string, string>;

export function zodErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
