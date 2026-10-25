import type { DeliveryMethod, ProductType } from "@/lib/types";

export const PRODUCT_TYPES: { value: ProductType; label: string; labelUz: string; hint: string; stockApplies: boolean }[] = [
  { value: "item", label: "Предметы и скины", labelUz: "Buyumlar va skinlar", hint: "Игровые предметы, скины, наборы", stockApplies: true },
  { value: "currency", label: "Игровая валюта", labelUz: "O‘yin valyutasi", hint: "Монеты, кристаллы, донат-валюта", stockApplies: true },
  { value: "service", label: "Услуги", labelUz: "Xizmatlar", hint: "Буст, обучение, прохождение (без передачи пароля)", stockApplies: false },
  { value: "key", label: "Коды и ключи", labelUz: "Kodlar va kalitlar", hint: "Коды пополнения, подарочные ключи", stockApplies: true },
  { value: "other", label: "Прочее по правилам игры", labelUz: "Boshqa", hint: "Только то, что разрешено правилами игры", stockApplies: true },
];

export const productTypeLabel = (t: ProductType) => PRODUCT_TYPES.find((x) => x.value === t)?.label ?? t;

export const DELIVERY_LABELS: Record<DeliveryMethod, string> = {
  chat: "Через чат заказа",
  key: "Код / ключ",
  manual: "Вручную продавцом",
  file: "Файл / скриншоты",
};
