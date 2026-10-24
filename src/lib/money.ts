/** Все суммы хранятся целыми числами в сумах (UZS), без float. */

export const FEE_PERCENT = 5; // демонстрационная комиссия площадки

export function formatUZS(amount: number): string {
  const rounded = Math.round(amount);
  const sign = rounded < 0 ? "-" : "";
  const digits = String(Math.abs(rounded)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${sign}${digits} сум`;
}

/** Комиссия считается целочисленно, с округлением вверх до сума. */
export function calcFee(priceUzs: number, percent: number = FEE_PERCENT): number {
  if (!Number.isInteger(priceUzs) || priceUzs < 0) throw new Error("Некорректная сумма");
  return Math.ceil((priceUzs * percent) / 100);
}
