import { platformRevenue } from "@/lib/ledger";
import type { Game, LedgerEntry, Order, OrderStatus } from "@/lib/types";

/** Статусы, при которых деньги покупателя считаются полученными (оборот). */
const TURNOVER: OrderStatus[] = ["paid", "in_progress", "delivered", "completed", "disputed", "refund_review"];

export interface GameStat {
  slug: string;
  name: string;
  orders: number; // завершённые
  turnoverUzs: number;
  feeUzs: number;
}
export interface SellerStat {
  sellerId: string;
  orders: number; // завершённые
  grossUzs: number;
  feeUzs: number;
  netUzs: number;
}

export interface PlatformStats {
  turnoverUzs: number;
  ordersCount: number;
  completedCount: number;
  activeCount: number;
  disputedCount: number;
  commissionAll: number;
  commissionDay: number;
  commissionWeek: number;
  commissionMonth: number;
  byGame: GameStat[];
  bySeller: SellerStat[];
}

export function platformStats(orders: Order[], ledger: LedgerEntry[], games: Game[], now: Date): PlatformStats {
  const completed = orders.filter((o) => o.status === "completed");
  const byGame = new Map<string, GameStat>();
  for (const g of games) byGame.set(g.slug, { slug: g.slug, name: g.name, orders: 0, turnoverUzs: 0, feeUzs: 0 });
  const bySeller = new Map<string, SellerStat>();
  for (const o of completed) {
    const g = byGame.get(o.gameSlug) ?? { slug: o.gameSlug, name: o.gameSlug, orders: 0, turnoverUzs: 0, feeUzs: 0 };
    g.orders += 1;
    g.turnoverUzs += o.commission.totalUzs;
    g.feeUzs += o.commission.feeUzs;
    byGame.set(g.slug, g);
    const s = bySeller.get(o.sellerId) ?? { sellerId: o.sellerId, orders: 0, grossUzs: 0, feeUzs: 0, netUzs: 0 };
    s.orders += 1;
    s.grossUzs += o.priceUzs;
    s.feeUzs += o.commission.feeUzs;
    s.netUzs += o.commission.sellerNetUzs;
    bySeller.set(s.sellerId, s);
  }
  return {
    turnoverUzs: orders.filter((o) => TURNOVER.includes(o.status)).reduce((s, o) => s + o.commission.totalUzs, 0),
    ordersCount: orders.length,
    completedCount: completed.length,
    activeCount: orders.filter((o) => ["paid", "in_progress", "delivered"].includes(o.status)).length,
    disputedCount: orders.filter((o) => ["disputed", "refund_review"].includes(o.status)).length,
    commissionAll: platformRevenue(ledger, "all", now),
    commissionDay: platformRevenue(ledger, "day", now),
    commissionWeek: platformRevenue(ledger, "week", now),
    commissionMonth: platformRevenue(ledger, "month", now),
    byGame: [...byGame.values()].sort((a, b) => b.feeUzs - a.feeUzs),
    bySeller: [...bySeller.values()].sort((a, b) => b.feeUzs - a.feeUzs),
  };
}

export interface SellerSummary {
  ordersTotal: number;
  completed: number;
  grossUzs: number; // стоимость товаров по завершённым заказам
  sellerFeesUzs: number; // удержанная с продавца комиссия
  netUzs: number; // доход продавца
  views: number;
}

export function sellerSummary(orders: Order[], sellerId: string, views: number): SellerSummary {
  const mine = orders.filter((o) => o.sellerId === sellerId);
  const done = mine.filter((o) => o.status === "completed");
  return {
    ordersTotal: mine.length,
    completed: done.length,
    grossUzs: done.reduce((s, o) => s + o.priceUzs, 0),
    sellerFeesUzs: done.reduce((s, o) => s + o.commission.sellerFeeUzs, 0),
    netUzs: done.reduce((s, o) => s + o.commission.sellerNetUzs, 0),
    views,
  };
}
