import { type CommissionSettings, calcCommission, checkOrderLimits } from "@/lib/commission";
import { isInStock } from "@/lib/catalog";
import type { Commission, Listing } from "@/lib/types";

export const MAX_QTY = 99;

export interface Quote {
  listingId: string;
  unitPriceUzs: number;
  quantity: number;
  priceUzs: number; // стоимость товара
  commission: Commission;
}

/**
 * Единый расчёт заказа: используется и на странице подтверждения, и при создании заказа.
 * Цена берётся из объявления в хранилище, комиссия — из настроек платформы.
 * Значения из браузера (цена, процент, итог) НЕ принимаются — приходит только количество.
 */
export function quote(
  listing: Listing,
  quantity: number,
  settings: CommissionSettings,
): { ok: true; data: Quote } | { ok: false; error: string } {
  if (listing.status !== "active") return { ok: false, error: "Объявление недоступно" };
  if (!Number.isInteger(quantity) || quantity < 1) return { ok: false, error: "Количество — целое число от 1" };
  if (quantity > MAX_QTY) return { ok: false, error: `Не более ${MAX_QTY} за один заказ` };
  if (!isInStock(listing)) return { ok: false, error: "Товара нет в наличии" };
  if (listing.stock !== null && quantity > listing.stock) return { ok: false, error: `В наличии только ${listing.stock} шт.` };
  const priceUzs = listing.priceUzs * quantity;
  const limit = checkOrderLimits(priceUzs, settings);
  if (limit) return { ok: false, error: limit };
  return {
    ok: true,
    data: {
      listingId: listing.id,
      unitPriceUzs: listing.priceUzs,
      quantity,
      priceUzs,
      commission: calcCommission(priceUzs, settings, { gameSlug: listing.gameSlug, sellerId: listing.sellerId }),
    },
  };
}
