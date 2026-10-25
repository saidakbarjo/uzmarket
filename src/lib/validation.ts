import { z } from "zod";

export const MAX_PRICE_UZS = 500_000_000;

export const gameSlugSchema = z
  .string()
  .trim()
  .min(2, "Выберите игру")
  .max(40)
  .regex(/^[a-z0-9-]+$/, "Некорректная игра");

export const productTypeSchema = z.enum(["item", "currency", "service", "key", "other"], { error: "Выберите тип товара" });

/** Уменьшенное изображение (data URL). Внешние адреса не принимаются. */
export const MAX_IMAGES = 4;
export const MAX_IMAGE_CHARS = 180_000; // ≈ 135 КБ после base64
export const imageSchema = z
  .string()
  .max(MAX_IMAGE_CHARS, "Изображение слишком большое")
  .regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/, "Недопустимое изображение");

export const listingSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(5, "Название — минимум 5 символов")
      .max(120, "Название — максимум 120 символов"),
    gameSlug: gameSlugSchema,
    productType: productTypeSchema,
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
    stock: z
      .number({ error: "Количество — число" })
      .int("Количество — целое число")
      .min(0, "Количество не может быть отрицательным")
      .max(100_000, "Слишком большое количество")
      .nullable(),
    available: z.boolean(),
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
      .min(10, "Опишите условия передачи (минимум 10 символов)")
      .max(1000, "Условия передачи — максимум 1000 символов"),
    images: z.array(imageSchema).max(MAX_IMAGES, `Не более ${MAX_IMAGES} изображений`).default([]),
    imageHue: z.number().int().min(0).max(359).optional(),
  })
  .refine((v) => !(v.productType === "service" && v.stock !== null && v.stock > 1000), { path: ["stock"], message: "Для услуги укажите разумное количество" });
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

export const sellerProfileSchema = z.object({
  shopName: z.string().trim().min(3, "Название — минимум 3 символа").max(40, "Название — максимум 40 символов"),
  about: z.string().trim().min(10, "Расскажите о себе (минимум 10 символов)").max(500, "Максимум 500 символов"),
  payoutMethod: z.enum(["card_demo", "bank_demo", "wallet_future"]),
  acceptRules: z.literal(true, { error: "Нужно принять правила продавца" }),
});

export const payoutRequestSchema = z.object({
  amountUzs: z
    .number({ error: "Укажите сумму числом" })
    .int("Сумма — целое число сумов")
    .min(1, "Укажите сумму")
    .max(MAX_PRICE_UZS * 10, "Сумма слишком велика"),
  method: z.enum(["card_demo", "bank_demo", "wallet_future"]),
  details: z.string().trim().min(3, "Укажите тестовые реквизиты").max(100, "Максимум 100 символов"),
});

export const gameSchema = z.object({
  name: z.string().trim().min(2, "Название — минимум 2 символа").max(40, "Название — максимум 40 символов"),
  nameUz: z.string().trim().max(40).default(""),
  nameEn: z.string().trim().max(40).default(""),
  description: z.string().trim().max(160, "Максимум 160 символов").default(""),
  hue: z.number().int().min(0).max(359),
});

const percent = z.number({ error: "Укажите процент числом" }).min(0, "Не меньше 0%").max(50, "Не больше 50%");

export const commissionSettingsSchema = z
  .object({
    defaultPercent: percent,
    minFeeEnabled: z.boolean(),
    minFeeUzs: z.number().int("Целое число сумов").min(0).max(1_000_000, "Слишком большая минимальная комиссия"),
    payer: z.enum(["seller", "buyer", "split"]),
    minOrderUzs: z.number().int("Целое число сумов").min(1000, "Минимум — 1 000 сум"),
    maxOrderUzs: z.number().int("Целое число сумов").max(MAX_PRICE_UZS, "Слишком большая сумма"),
  })
  .refine((v) => v.minOrderUzs < v.maxOrderUzs, { path: ["maxOrderUzs"], message: "Максимум должен быть больше минимума" });

export const percentOverrideSchema = percent;

export const decisionSchema = z.object({
  decision: z.enum(["refund_buyer", "complete_seller"]),
  comment: z.string().trim().min(5, "Напишите решение (минимум 5 символов)").max(1000),
});

export const replySchema = z.object({
  text: z.string().trim().min(1, "Пустое сообщение").max(1000, "Максимум 1000 символов"),
  evidence: z.string().trim().max(1000, "Слишком длинное поле").default(""),
});
