"use client";

import { useSyncExternalStore } from "react";
import { z } from "zod";
import { DEFAULT_COMMISSION, type CommissionSettings } from "@/lib/commission";
import { quote, type Quote } from "@/lib/checkout";
import {
  balanceOf,
  hasEntry,
  isNonNegative,
  onOrderCompleted,
  onOrderPaid,
  onOrderReversed,
  onPayoutPaid,
  onPayoutRejected,
  onPayoutRequested,
  type Balance,
} from "@/lib/ledger";
import { MIN_PAYOUT_UZS, applyPayoutStatus, looksLikeRealAccountNumber, type PayoutAction } from "@/lib/payouts";
import {
  DEMO_PASSWORD,
  SITE_NAME,
  seedCommission,
  seedGames,
  seedListings,
  seedProfiles,
  seedReviews,
  seedSellerProfiles,
} from "@/lib/data/seed";
import { seedAudit, seedLedger, seedNotifications, seedOrders, seedPayouts, seedTickets } from "@/lib/data/seed-orders";
import {
  DomainError,
  addMessage,
  applyAction,
  canView,
  setFulfillmentNote,
  type OrderAction,
} from "@/lib/orders-domain";
import { demoPayments, makeEvent } from "@/lib/payments/demo-provider";
import type { PaymentEvent, PaymentIntent, PaymentOutcome } from "@/lib/payments/provider";
import { toast } from "@/lib/toast";
import type {
  AppNotification,
  AuditEntry,
  Game,
  LedgerEntry,
  Listing,
  ListingStatus,
  Order,
  PayoutRequest,
  Profile,
  Review,
  SellerProfile,
  SiteSettings,
  Ticket,
  TicketStatus,
} from "@/lib/types";
import {
  type FieldErrors,
  commissionSettingsSchema,
  decisionSchema,
  gameSchema,
  listingSchema,
  loginSchema,
  messageSchema,
  payoutRequestSchema,
  percentOverrideSchema,
  registerSchema,
  replySchema,
  reviewSchema,
  sellerProfileSchema,
  ticketSchema,
  zodErrors,
} from "@/lib/validation";

/**
 * ДЕМО-хранилище. Все данные живут в localStorage браузера.
 * Это НЕ защищённая система: пользователь с DevTools может изменить данные.
 * Настоящая авторизация, расчёт комиссии и права будут выполняться на сервере
 * (Supabase Auth + RLS + RPC-функции, см. supabase/migrations).
 * Тем не менее все действия ниже проверяют права по текущей сессии (а не по параметрам из UI),
 * берут цену и комиссию из хранилища, а не от клиента, и используют доменные правила,
 * пригодные для переноса на сервер.
 */

const STORAGE_KEY = "uzmarket.demo.v2";
const VERSION = 2;

export interface Credential {
  salt: string;
  hash: string;
}

export interface DemoState {
  version: number;
  profiles: Profile[];
  sellerProfiles: SellerProfile[];
  games: Game[];
  listings: Listing[];
  orders: Order[];
  reviews: Review[];
  hiddenReviewIds: string[];
  favorites: Record<string, string[]>;
  tickets: Ticket[];
  notifications: AppNotification[];
  session: { userId: string } | null;
  credentials: Record<string, Credential>;
  intents: PaymentIntent[];
  processedEvents: string[];
  lastEvents: Record<string, PaymentEvent>;
  ledger: LedgerEntry[];
  payouts: PayoutRequest[];
  audit: AuditEntry[];
  commission: CommissionSettings;
  settings: SiteSettings;
  counters: { order: number; ticket: number; payout: number };
}

function seedState(): DemoState {
  return {
    version: VERSION,
    profiles: seedProfiles,
    sellerProfiles: seedSellerProfiles,
    games: seedGames,
    listings: seedListings,
    orders: seedOrders,
    reviews: seedReviews,
    hiddenReviewIds: [],
    favorites: {},
    tickets: seedTickets,
    notifications: seedNotifications,
    session: null,
    credentials: {},
    intents: [],
    processedEvents: [],
    lastEvents: {},
    ledger: seedLedger,
    payouts: seedPayouts,
    audit: seedAudit,
    commission: seedCommission,
    settings: { moderationEnabled: false, siteName: SITE_NAME },
    counters: { order: 100300, ticket: 5100, payout: 7100 },
  };
}

const serverState: DemoState = seedState();
let state: DemoState = serverState;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as DemoState;
    if (parsed && parsed.version === VERSION && Array.isArray(parsed.profiles)) {
      state = parsed;
    }
  } catch {
    /* повреждённые данные — остаёмся на сидах */
  }
}

let warnedQuota = false;
function persist() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    if (!warnedQuota) {
      warnedQuota = true;
      toast.error("Не удалось сохранить данные: хранилище браузера переполнено. Уменьшите изображения или сбросьте демо-данные.");
    }
  }
}

function emit() {
  listeners.forEach((l) => l());
}

/** Единая точка записи: заменяет состояние целиком (атомарно), сохраняет и уведомляет подписчиков. */
function commit(next: DemoState) {
  load();
  state = next;
  persist();
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY && e.newValue) {
      try {
        const parsed = JSON.parse(e.newValue) as DemoState;
        if (parsed.version === VERSION) {
          state = parsed;
          emit();
        }
      } catch {
        /* ignore */
      }
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot(): DemoState {
  load();
  return state;
}

function getServerSnapshot(): DemoState {
  return serverState;
}

export function useDemoState(): DemoState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

const noopSubscribe = () => () => {};
/** true только в браузере после гидратации. */
export function useHydrated(): boolean {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

export function useCurrentUser(): { user: Profile | null; ready: boolean } {
  const s = useDemoState();
  const ready = useHydrated();
  const user = s.session ? (s.profiles.find((p) => p.id === s.session!.userId) ?? null) : null;
  return { user: user && !user.blocked ? user : null, ready };
}

/* ───────────── вспомогательное ───────────── */

export type Result<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: FieldErrors };

const ok = <T = undefined>(data?: T): Result<T> => ({ ok: true, data: data as T });
const fail = (error: string, fieldErrors?: FieldErrors): Result<never> => ({ ok: false, error, fieldErrors });

function rid(prefix: string): string {
  const rnd =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 10)
      : Math.random().toString(36).slice(2, 12);
  return `${prefix}-${rnd}`;
}

function currentUser(): Profile | null {
  load();
  const s = state;
  if (!s.session) return null;
  const p = s.profiles.find((x) => x.id === s.session!.userId);
  return p && !p.blocked ? p : null;
}

function requireUser(): Profile {
  const u = currentUser();
  if (!u) throw new DomainError("Войдите в аккаунт, чтобы продолжить", "forbidden");
  return u;
}

function requireAdmin(): Profile {
  const u = requireUser();
  if (u.role !== "admin") throw new DomainError("Нужны права администратора", "forbidden");
  return u;
}

function requireSeller(): Profile {
  const u = requireUser();
  if (!u.isSeller) throw new DomainError("Сначала активируйте режим продавца", "forbidden");
  return u;
}

function guard<T>(fn: () => Result<T>): Result<T> {
  load();
  try {
    return fn();
  } catch (e) {
    if (e instanceof DomainError) return fail(e.message);
    // внутренние ошибки не показываем пользователю
    console.error(e);
    return fail("Что-то пошло не так. Попробуйте ещё раз.");
  }
}

async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/* чистые помощники: возвращают НОВОЕ состояние */

function addNotification(s: DemoState, userId: string, text: string, href?: string): DemoState {
  const n: AppNotification = { id: rid("n"), userId, text, at: new Date().toISOString(), read: false, href };
  return { ...s, notifications: [n, ...s.notifications].slice(0, 300) };
}

function notifyAdmins(s: DemoState, text: string, href?: string): DemoState {
  return s.profiles.filter((p) => p.role === "admin").reduce((acc, p) => addNotification(acc, p.id, text, href), s);
}

function addAudit(s: DemoState, actorId: string | "system", action: string, entity: string, entityId: string, detail: string): DemoState {
  const e: AuditEntry = { id: rid("au"), at: new Date().toISOString(), actorId, action, entity, entityId, detail };
  return { ...s, audit: [e, ...s.audit].slice(0, 1000) };
}

function addLedger(s: DemoState, e: LedgerEntry): DemoState {
  return { ...s, ledger: [...s.ledger, e] };
}

function replaceOrderIn(s: DemoState, updated: Order): DemoState {
  return { ...s, orders: s.orders.map((o) => (o.id === updated.id ? updated : o)) };
}

function findOrderFor(actor: Profile, orderId: string): Order {
  const o = state.orders.find((x) => x.id === orderId);
  if (!o || !canView(o, actor)) throw new DomainError("Заказ не найден", "not_found");
  return o;
}

const fmt = (n: number) => `${n.toLocaleString("ru-RU")} сум`;

/** Обращения, доступные пользователю: свои + споры по заказам, где он продавец. */
export function canAccessTicket(s: DemoState, u: Profile, t: Ticket): boolean {
  if (u.role === "admin" || t.authorId === u.id) return true;
  if (t.kind === "dispute" && t.orderId) return s.orders.find((o) => o.id === t.orderId)?.sellerId === u.id;
  return false;
}

export function ticketsForUser(s: DemoState, u: Profile): Ticket[] {
  return s.tickets.filter((t) => canAccessTicket(s, u, t));
}

/* ───────────── побочные эффекты переходов заказа (деньги, остатки) ───────────── */

/**
 * Применяет к заказу действие и все связанные финансовые эффекты ОДНИМ новым состоянием:
 *  — завершение: доход продавца становится доступным, признаётся комиссия платформы (один раз);
 *  — возврат/отмена после оплаты: ожидаемый доход снимается, платёж возвращается через провайдера;
 *  — отмена/возврат: остаток товара возвращается.
 * Повторная обработка не создаёт дублей: записи леджера проверяются по заказу.
 */
function transition(s: DemoState, order: Order, action: OrderAction, actor: Profile, note?: string): { s: DemoState; order: Order } {
  const updated = applyAction(order, action, actor, new Date(), note);
  const at = updated.updatedAt;
  let next = replaceOrderIn(s, updated);

  if (updated.status === "completed" && order.status !== "completed") {
    if (hasEntry(next.ledger, "order_paid", { orderId: order.id }) && !hasEntry(next.ledger, "order_released", { orderId: order.id })) {
      next = addLedger(next, onOrderCompleted(updated, at));
      next = { ...next, profiles: next.profiles.map((p) => (p.id === order.sellerId ? { ...p, salesCount: p.salesCount + 1 } : p)) };
      next = addAudit(next, actor.id, "ledger.order_released", "order", order.id, `${order.number}: комиссия платформы ${fmt(updated.commission.feeUzs)}, доход продавца ${fmt(updated.commission.sellerNetUzs)}`);
    }
  }

  if ((updated.status === "cancelled" || updated.status === "refunded") && order.status !== updated.status) {
    const paid = hasEntry(next.ledger, "order_paid", { orderId: order.id });
    if (paid && !hasEntry(next.ledger, "order_reversed", { orderId: order.id }) && !hasEntry(next.ledger, "order_released", { orderId: order.id })) {
      next = addLedger(next, onOrderReversed(updated, at));
      next = addAudit(next, actor.id, "ledger.order_reversed", "order", order.id, `${order.number}: оплата возвращена (тест)`);
    }
    next = { ...next, listings: next.listings.map((l) => (l.id === order.listingId && l.stock !== null ? { ...l, stock: l.stock + order.quantity } : l)) };
    if (updated.status === "refunded") {
      const intent = [...next.intents].reverse().find((i) => i.orderId === order.id && i.status === "succeeded");
      if (intent) {
        const refunded = demoPayments.refund(intent);
        next = { ...next, intents: next.intents.map((i) => (i.id === refunded.id ? refunded : i)) };
      }
    }
  }
  next = addAudit(next, actor.id, `order.${action}`, "order", order.id, `${order.number}: ${order.status} → ${updated.status}`);
  return { s: next, order: updated };
}

/* ───────────── авторизация (ДЕМО) ───────────── */

export async function register(input: unknown): Promise<Result<Profile>> {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) return fail("Проверьте форму", zodErrors(parsed.error));
  load();
  const { username, email, password } = parsed.data;
  if (state.profiles.some((p) => p.email === email)) return fail("Этот e-mail уже зарегистрирован", { email: "Этот e-mail уже зарегистрирован" });
  if (state.profiles.some((p) => p.username.toLowerCase() === username.toLowerCase()))
    return fail("Это имя уже занято", { username: "Это имя уже занято" });

  const salt = rid("salt");
  const hash = await sha256(`${salt}:${password}`);
  const hue = [...username].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7);
  const profile: Profile = {
    id: rid("u"),
    username,
    email,
    role: "user", // роль ВСЕГДА user: самоназначение администратора невозможно
    isSeller: false,
    isDemo: false,
    blocked: false,
    createdAt: new Date().toISOString(),
    rating: 0,
    reviewsCount: 0,
    salesCount: 0,
    verified: false,
    about: "",
    avatar: `hue:${hue}`,
  };
  commit({
    ...state,
    profiles: [...state.profiles, profile],
    credentials: { ...state.credentials, [email]: { salt, hash } },
    session: { userId: profile.id },
  });
  return ok(profile);
}

export async function login(input: unknown): Promise<Result<Profile>> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return fail("Проверьте форму", zodErrors(parsed.error));
  load();
  const { email, password } = parsed.data;
  const profile = state.profiles.find((p) => p.email === email);
  const generic = "Неверный e-mail или пароль";
  if (!profile) return fail(generic);

  let valid = false;
  const cred = state.credentials[email];
  if (cred) valid = (await sha256(`${cred.salt}:${password}`)) === cred.hash;
  else if (profile.isDemo) valid = password === DEMO_PASSWORD; // публичные тестовые аккаунты
  if (!valid) return fail(generic);
  if (profile.blocked) return fail("Аккаунт заблокирован администратором");

  commit({ ...state, session: { userId: profile.id } });
  return ok(profile);
}

export function logout() {
  load();
  commit({ ...state, session: null });
}

export function resetDemoData() {
  commit(seedState());
}

/* ───────────── избранное ───────────── */

export function toggleFavorite(listingId: string): Result<{ favorited: boolean }> {
  return guard(() => {
    const u = requireUser();
    if (!state.listings.some((l) => l.id === listingId)) throw new DomainError("Объявление не найдено", "not_found");
    const cur = state.favorites[u.id] ?? [];
    const has = cur.includes(listingId);
    const next = has ? cur.filter((x) => x !== listingId) : [...cur, listingId];
    commit({ ...state, favorites: { ...state.favorites, [u.id]: next } });
    return ok({ favorited: !has });
  });
}

/* ───────────── профиль продавца ───────────── */

export function becomeSeller(input: unknown): Result<SellerProfile> {
  return guard(() => {
    const u = requireUser();
    if (u.isSeller) return fail("Режим продавца уже активирован");
    const parsed = sellerProfileSchema.safeParse(input);
    if (!parsed.success) return fail("Проверьте форму", zodErrors(parsed.error));
    const now = new Date().toISOString();
    const sp: SellerProfile = {
      userId: u.id,
      shopName: parsed.data.shopName,
      about: parsed.data.about,
      payoutMethod: parsed.data.payoutMethod,
      createdAt: now,
      acceptedRulesAt: now,
    };
    let next: DemoState = {
      ...state,
      sellerProfiles: [...state.sellerProfiles.filter((x) => x.userId !== u.id), sp],
      profiles: state.profiles.map((p) => (p.id === u.id ? { ...p, isSeller: true } : p)),
    };
    next = addAudit(next, u.id, "seller.activated", "profile", u.id, `Режим продавца: «${sp.shopName}»`);
    commit(next);
    return ok(sp);
  });
}

export function updateSellerProfile(input: unknown): Result {
  return guard(() => {
    const u = requireSeller();
    const parsed = sellerProfileSchema.safeParse({ ...(input as object), acceptRules: true });
    if (!parsed.success) return fail("Проверьте форму", zodErrors(parsed.error));
    commit({
      ...state,
      sellerProfiles: state.sellerProfiles.map((x) =>
        x.userId === u.id ? { ...x, shopName: parsed.data.shopName, about: parsed.data.about, payoutMethod: parsed.data.payoutMethod } : x,
      ),
    });
    return ok();
  });
}

/* ───────────── объявления ───────────── */

function checkGame(s: DemoState, slug: string): Game {
  const g = s.games.find((x) => x.slug === slug);
  if (!g) throw new DomainError("Такой игры нет в каталоге", "validation");
  if (!g.enabled) throw new DomainError("Эта игра временно отключена", "validation");
  return g;
}

export function createListing(input: unknown): Result<Listing> {
  return guard(() => {
    const u = requireSeller();
    const parsed = listingSchema.safeParse(input);
    if (!parsed.success) return fail("Проверьте форму", zodErrors(parsed.error));
    checkGame(state, parsed.data.gameSlug);
    const needsModeration = state.settings.moderationEnabled && u.role !== "admin";
    const listing: Listing = {
      ...parsed.data,
      id: rid("l"),
      sellerId: u.id, // продавец берётся из сессии, а не из формы
      status: needsModeration ? "pending" : "active",
      isDemo: false,
      views: 0,
      createdAt: new Date().toISOString(),
    };
    let next: DemoState = { ...state, listings: [listing, ...state.listings] };
    next = addAudit(next, u.id, "listing.created", "listing", listing.id, `«${listing.title}»: ${needsModeration ? "отправлено на модерацию" : "опубликовано"}`);
    if (needsModeration) next = notifyAdmins(next, `Новое объявление на модерации: «${listing.title}»`, "/admin/listings");
    commit(next);
    return ok(listing);
  });
}

export function updateListing(id: string, input: unknown): Result<Listing> {
  return guard(() => {
    const u = requireUser();
    const existing = state.listings.find((l) => l.id === id);
    if (!existing) throw new DomainError("Объявление не найдено", "not_found");
    const isOwner = existing.sellerId === u.id;
    if (!isOwner && u.role !== "admin") throw new DomainError("Нельзя менять чужое объявление", "forbidden");
    if (existing.status === "blocked" && u.role !== "admin") throw new DomainError("Объявление заблокировано модератором", "forbidden");
    const parsed = listingSchema.safeParse(input);
    if (!parsed.success) return fail("Проверьте форму", zodErrors(parsed.error));
    checkGame(state, parsed.data.gameSlug);
    // sellerId, createdAt не берутся из формы; цена в уже созданных заказах не меняется
    const needsModeration = state.settings.moderationEnabled && u.role !== "admin" && existing.status !== "paused";
    const updated: Listing = { ...existing, ...parsed.data, status: needsModeration ? "pending" : existing.status, moderationNote: needsModeration ? undefined : existing.moderationNote };
    let next: DemoState = { ...state, listings: state.listings.map((l) => (l.id === id ? updated : l)) };
    next = addAudit(next, u.id, "listing.updated", "listing", id, `«${updated.title}»${needsModeration ? " — повторная модерация" : ""}`);
    if (needsModeration) next = notifyAdmins(next, `Объявление изменено и ждёт модерации: «${updated.title}»`, "/admin/listings");
    commit(next);
    return ok(updated);
  });
}

/** Пауза/возобновление — владелец; блокировка — только администратор. */
export function setListingStatus(id: string, status: ListingStatus): Result {
  return guard(() => {
    const u = requireUser();
    const l = state.listings.find((x) => x.id === id);
    if (!l) throw new DomainError("Объявление не найдено", "not_found");
    const isOwner = l.sellerId === u.id;
    if (u.role !== "admin") {
      if (!isOwner) throw new DomainError("Нельзя менять чужое объявление", "forbidden");
      if (status !== "active" && status !== "paused") throw new DomainError("Недопустимый статус", "forbidden");
      if (l.status !== "active" && l.status !== "paused") throw new DomainError("Объявление сейчас нельзя изменить: оно на модерации, отклонено или заблокировано", "forbidden");
    } else if (!["active", "paused", "blocked"].includes(status)) {
      throw new DomainError("Недопустимый статус", "forbidden");
    }
    let next: DemoState = { ...state, listings: state.listings.map((x) => (x.id === id ? { ...x, status } : x)) };
    next = addAudit(next, u.id, `listing.${status}`, "listing", id, `«${l.title}»: ${l.status} → ${status}`);
    if (status === "blocked" && u.role === "admin") next = addNotification(next, l.sellerId, `Объявление «${l.title}» заблокировано администратором.`, "/seller");
    commit(next);
    return ok();
  });
}

/** Модерация: одобрить или отклонить объявление (только администратор). */
export function moderateListing(id: string, decision: "approve" | "reject", note = ""): Result {
  return guard(() => {
    const admin = requireAdmin();
    const l = state.listings.find((x) => x.id === id);
    if (!l) throw new DomainError("Объявление не найдено", "not_found");
    if (decision === "reject" && note.trim().length < 5) return fail("Укажите причину отказа (минимум 5 символов)");
    const status: ListingStatus = decision === "approve" ? "active" : "rejected";
    let next: DemoState = { ...state, listings: state.listings.map((x) => (x.id === id ? { ...x, status, moderationNote: decision === "reject" ? note.trim() : undefined } : x)) };
    next = addAudit(next, admin.id, `listing.${decision}`, "listing", id, `«${l.title}»${note ? `: ${note.trim()}` : ""}`);
    next = addNotification(
      next,
      l.sellerId,
      decision === "approve" ? `Объявление «${l.title}» одобрено и опубликовано.` : `Объявление «${l.title}» отклонено: ${note.trim()}`,
      "/seller",
    );
    commit(next);
    return ok();
  });
}

export function deleteListing(id: string): Result {
  return guard(() => {
    const u = requireUser();
    const l = state.listings.find((x) => x.id === id);
    if (!l) throw new DomainError("Объявление не найдено", "not_found");
    if (l.sellerId !== u.id && u.role !== "admin") throw new DomainError("Нельзя удалить чужое объявление", "forbidden");
    const active = state.orders.some(
      (o) => o.listingId === id && ["pending_payment", "paid", "in_progress", "delivered", "disputed", "refund_review"].includes(o.status),
    );
    if (active) return fail("Есть незавершённые заказы — сначала завершите или отмените их");
    let next: DemoState = { ...state, listings: state.listings.filter((x) => x.id !== id) };
    next = addAudit(next, u.id, "listing.deleted", "listing", id, `«${l.title}»`);
    commit(next);
    return ok();
  });
}

/** Счётчик просмотров: не чаще одного раза за сессию браузера, владелец не считается. */
export function registerView(listingId: string) {
  load();
  if (typeof window === "undefined") return;
  const l = state.listings.find((x) => x.id === listingId);
  if (!l) return;
  const me = currentUser();
  if (me && me.id === l.sellerId) return;
  try {
    const key = `uzmarket.viewed.${listingId}`;
    if (window.sessionStorage.getItem(key)) return;
    window.sessionStorage.setItem(key, "1");
  } catch {
    return;
  }
  commit({ ...state, listings: state.listings.map((x) => (x.id === listingId ? { ...x, views: x.views + 1 } : x)) });
}

/* ───────────── заказы ───────────── */

/** Расчёт для страницы подтверждения: тот же код, что и при создании заказа. */
export function quoteFor(s: DemoState, listingId: string, quantity: number): { ok: true; data: Quote } | { ok: false; error: string } {
  const l = s.listings.find((x) => x.id === listingId);
  if (!l) return { ok: false, error: "Объявление не найдено" };
  return quote(l, quantity, s.commission);
}

export function createOrder(listingId: string, quantity = 1): Result<Order> {
  return guard(() => {
    const u = requireUser();
    const l = state.listings.find((x) => x.id === listingId);
    if (!l || l.status !== "active") throw new DomainError("Объявление недоступно", "not_found");
    const seller = state.profiles.find((p) => p.id === l.sellerId);
    if (!seller || seller.blocked) throw new DomainError("Продавец недоступен", "not_found");
    if (!state.games.find((g) => g.slug === l.gameSlug)?.enabled) throw new DomainError("Игра временно отключена", "not_found");
    if (l.sellerId === u.id) return fail("Нельзя купить собственный товар");

    // цена и комиссия считаются здесь, из хранилища, по актуальным настройкам платформы
    const q = quote(l, quantity, state.commission);
    if (!q.ok) return fail(q.error);

    const now = new Date().toISOString();
    const n = state.counters.order + 1;
    const order: Order = {
      id: rid("o"),
      number: `UZM-${n}`,
      listingId: l.id,
      listingTitle: l.title,
      gameSlug: l.gameSlug,
      buyerId: u.id,
      sellerId: l.sellerId,
      unitPriceUzs: q.data.unitPriceUzs,
      quantity: q.data.quantity,
      priceUzs: q.data.priceUzs,
      commission: q.data.commission, // фиксируется в заказе: смена тарифа не затронет этот заказ
      status: "pending_payment",
      createdAt: now,
      updatedAt: now,
      events: [{ id: rid("ev"), at: now, status: "pending_payment", actorId: u.id, note: "Заказ создан. Ожидает тестовой оплаты." }],
      messages: [],
      isDemo: true,
    };
    let next: DemoState = {
      ...state,
      orders: [order, ...state.orders],
      counters: { ...state.counters, order: n },
      // остаток резервируется на время заказа; при отмене/возврате возвращается
      listings: state.listings.map((x) => (x.id === l.id && x.stock !== null ? { ...x, stock: x.stock - order.quantity } : x)),
    };
    next = addAudit(
      next,
      u.id,
      "order.created",
      "order",
      order.id,
      `${order.number}: ${order.quantity} × ${fmt(order.unitPriceUzs)}; комиссия ${order.commission.percent}% (${order.commission.source}) = ${fmt(order.commission.feeUzs)}, платит: ${order.commission.payer}`,
    );
    commit(next);
    return ok(order);
  });
}

const OUTCOME_TO_EVENT = {
  success: "payment.succeeded",
  fail: "payment.failed",
  cancel: "payment.cancelled",
} as const;

/** Тестовая оплата через DemoPaymentProvider. Реальные деньги не используются. */
export function payOrder(orderId: string, outcome: PaymentOutcome): Result<{ message: string }> {
  return guard(() => {
    const u = requireUser();
    const order = findOrderFor(u, orderId);
    if (order.buyerId !== u.id) throw new DomainError("Оплатить заказ может только покупатель", "forbidden");
    if (order.status !== "pending_payment") throw new DomainError("Заказ уже обработан", "invalid_state");

    let intent = state.intents.find((i) => i.orderId === orderId && i.status === "created");
    if (!intent) {
      const attempt = state.intents.filter((i) => i.orderId === orderId).length + 1;
      intent = demoPayments.createIntent({
        orderId,
        amountUzs: order.commission.totalUzs, // сумма берётся из зафиксированного заказа
        feeUzs: order.commission.feeUzs,
        idempotencyKey: `${orderId}:pay:${attempt}`,
      });
    }
    const event = makeEvent(intent.id, OUTCOME_TO_EVENT[outcome]);
    const res = demoPayments.handleEvent(intent, event, new Set(state.processedEvents));
    if (!res.applied) return fail("Платёж уже обработан");

    const exists = state.intents.some((i) => i.id === intent!.id);
    let next: DemoState = {
      ...state,
      intents: exists ? state.intents.map((i) => (i.id === res.intent.id ? res.intent : i)) : [...state.intents, res.intent],
      processedEvents: [...state.processedEvents, event.eventId],
      lastEvents: { ...state.lastEvents, [orderId]: event },
    };

    if (outcome === "success") {
      const t = transition(next, order, "pay_success", u);
      next = t.s;
      if (!hasEntry(next.ledger, "order_paid", { orderId })) {
        next = addLedger(next, onOrderPaid(t.order, t.order.updatedAt));
      }
      next = addNotification(next, order.sellerId, `Заказ ${order.number} оплачен (тест). Приступайте к выполнению.`, `/orders?id=${order.id}`);
      next = addAudit(next, u.id, "payment.succeeded", "order", orderId, `${order.number}: тестовая оплата ${fmt(order.commission.totalUzs)}`);
    } else if (outcome === "fail") {
      next = replaceOrderIn(next, applyAction(order, "pay_fail", u));
      next = addAudit(next, u.id, "payment.failed", "order", orderId, `${order.number}: тестовая оплата не прошла`);
    } else {
      next = transition(next, order, "cancel", u).s;
    }
    commit(next);
    const messages = {
      success: "Тестовая оплата прошла. DEMO — реальные деньги не переводятся.",
      fail: "Тестовая оплата не прошла. Можно попробовать снова.",
      cancel: "Заказ отменён.",
    };
    return ok({ message: messages[outcome] });
  });
}

/** Имитация повторного уведомления провайдера: должно быть проигнорировано. */
export function replayLastPaymentEvent(orderId: string): Result<{ applied: boolean }> {
  return guard(() => {
    const u = requireUser();
    const order = findOrderFor(u, orderId);
    const ev = state.lastEvents[orderId];
    if (!ev) return fail("Для этого заказа ещё не было платёжных событий");
    const intent = state.intents.find((i) => i.id === ev.intentId);
    if (!intent) return fail("Платёж не найден");
    const res = demoPayments.handleEvent(intent, ev, new Set(state.processedEvents));
    const now = new Date().toISOString();
    const updated: Order = {
      ...order,
      updatedAt: now,
      messages: [
        ...order.messages,
        {
          id: rid("m"),
          at: now,
          authorId: "system",
          text: res.applied
            ? "Платёжное событие применено."
            : "Повторное уведомление платёжного провайдера проигнорировано (идемпотентность): статус и баланс не изменились.",
        },
      ],
    };
    commit(replaceOrderIn(state, updated));
    return ok({ applied: res.applied });
  });
}

export function orderAction(orderId: string, action: OrderAction, note?: string): Result<Order> {
  return guard(() => {
    const u = requireUser();
    if (action === "pay_success" || action === "pay_fail") throw new DomainError("Оплата выполняется через платёжный модуль", "forbidden");
    if (action === "open_dispute") throw new DomainError("Спор открывается через форму обращения", "forbidden");
    if (action === "resolve_dispute_complete" || action === "refund") {
      // решения по спорам и возвраты — только администратор (доменная логика проверяет это повторно)
      requireAdmin();
    }
    const order = findOrderFor(u, orderId);
    if (action === "deliver" && !order.fulfillmentNote) {
      return fail("Сначала заполните информацию о выполнении заказа");
    }
    const t = transition(state, order, action, u, note);
    let next = t.s;

    const other = u.id === order.buyerId ? order.sellerId : order.buyerId;
    const labels: Partial<Record<OrderAction, string>> = {
      start: "Продавец приступил к выполнению",
      deliver: "Продавец выдал заказ — подтвердите получение",
      confirm: "Покупатель подтвердил получение",
      cancel: "Заказ отменён",
      review_refund: "Возврат рассматривается",
      refund: "Оформлен тестовый возврат",
      resolve_dispute_complete: "Спор решён: заказ завершён",
    };
    if (labels[action]) {
      next = addNotification(next, other, `${order.number}: ${labels[action]}.`, `/orders?id=${order.id}`);
      if (u.role === "admin") next = addNotification(next, order.buyerId === other ? order.sellerId : order.buyerId, `${order.number}: ${labels[action]}.`, `/orders?id=${order.id}`);
    }
    commit(next);
    return ok(t.order);
  });
}

export function sendOrderMessage(orderId: string, text: string): Result {
  return guard(() => {
    const u = requireUser();
    const parsed = messageSchema.safeParse({ text });
    if (!parsed.success) return fail(parsed.error.issues[0].message);
    const order = findOrderFor(u, orderId);
    const updated = addMessage(order, u, parsed.data.text);
    let next = replaceOrderIn(state, updated);
    const other = u.id === order.buyerId ? order.sellerId : order.buyerId;
    if (u.role !== "admin") next = addNotification(next, other, `Новое сообщение в заказе ${order.number}.`, `/orders?id=${order.id}`);
    commit(next);
    return ok();
  });
}

export function saveFulfillment(orderId: string, note: string): Result {
  return guard(() => {
    const u = requireUser();
    const order = findOrderFor(u, orderId);
    commit(replaceOrderIn(state, setFulfillmentNote(order, u, note)));
    return ok();
  });
}

/* ───────────── отзывы ───────────── */

export function addReview(orderId: string, input: unknown): Result<Review> {
  return guard(() => {
    const u = requireUser();
    const order = findOrderFor(u, orderId);
    if (order.buyerId !== u.id) throw new DomainError("Оставить отзыв может только покупатель", "forbidden");
    if (order.status !== "completed") throw new DomainError("Отзыв можно оставить после завершения заказа", "invalid_state");
    if (state.reviews.some((r) => r.orderId === orderId)) return fail("Вы уже оставили отзыв по этому заказу");
    const parsed = reviewSchema.safeParse(input);
    if (!parsed.success) return fail("Проверьте форму", zodErrors(parsed.error));
    const review: Review = {
      id: rid("r"),
      listingId: order.listingId,
      orderId,
      authorId: u.id,
      authorName: u.username,
      sellerId: order.sellerId,
      rating: parsed.data.rating,
      text: parsed.data.text,
      createdAt: new Date().toISOString(),
      isDemo: false,
    };
    let next: DemoState = {
      ...state,
      reviews: [review, ...state.reviews],
      profiles: state.profiles.map((p) => {
        if (p.id !== order.sellerId) return p;
        const total = p.rating * p.reviewsCount + review.rating;
        const count = p.reviewsCount + 1;
        return { ...p, reviewsCount: count, rating: Math.round((total / count) * 10) / 10 };
      }),
    };
    next = addNotification(next, order.sellerId, `Новый отзыв по заказу ${order.number}: ${review.rating}/5.`, `/listing?id=${order.listingId}`);
    commit(next);
    return ok(review);
  });
}

/** Ответ продавца на отзыв о его товаре (один ответ на отзыв). */
export function replyToReview(reviewId: string, text: string): Result {
  return guard(() => {
    const u = requireSeller();
    const parsed = z.string().trim().min(2, "Слишком короткий ответ").max(500, "Максимум 500 символов").safeParse(text);
    if (!parsed.success) return fail(parsed.error.issues[0].message);
    const r = state.reviews.find((x) => x.id === reviewId);
    if (!r || r.sellerId !== u.id) throw new DomainError("Нельзя отвечать на чужие отзывы", "forbidden");
    if (r.sellerReply) return fail("Вы уже ответили на этот отзыв");
    commit({
      ...state,
      reviews: state.reviews.map((x) => (x.id === reviewId ? { ...x, sellerReply: { text: parsed.data, at: new Date().toISOString() } } : x)),
    });
    return ok();
  });
}

export function setReviewHidden(reviewId: string, hidden: boolean): Result {
  return guard(() => {
    const admin = requireAdmin();
    let next: DemoState = {
      ...state,
      hiddenReviewIds: hidden ? [...new Set([...state.hiddenReviewIds, reviewId])] : state.hiddenReviewIds.filter((x) => x !== reviewId),
    };
    next = addAudit(next, admin.id, hidden ? "review.hidden" : "review.shown", "review", reviewId, "");
    commit(next);
    return ok();
  });
}

/* ───────────── поддержка, споры, жалобы ───────────── */

export function createTicket(input: unknown): Result<Ticket> {
  return guard(() => {
    const u = requireUser();
    const parsed = ticketSchema.safeParse(input);
    if (!parsed.success) return fail("Проверьте форму", zodErrors(parsed.error));
    const { orderId, ...rest } = parsed.data;
    if (rest.kind === "dispute" && !orderId) return fail("Для спора выберите заказ", { orderId: "Выберите заказ" });
    let disputedOrder: Order | null = null;
    if (orderId) {
      const o = state.orders.find((x) => x.id === orderId);
      if (!o || (o.buyerId !== u.id && o.sellerId !== u.id)) throw new DomainError("Заказ не найден", "not_found");
      if (rest.kind === "dispute") {
        if (state.tickets.some((t) => t.kind === "dispute" && t.orderId === orderId && !["resolved", "rejected"].includes(t.status)))
          return fail("По этому заказу уже открыт спор");
        // спор может открыть только покупатель и только в допустимом статусе (проверяет доменная логика)
        disputedOrder = applyAction(o, "open_dispute", u, new Date(), `Причина: ${rest.reason}.`);
      }
    }
    const n = state.counters.ticket + 1;
    const now = new Date().toISOString();
    const ticket: Ticket = {
      ...rest,
      id: rid("t"),
      number: `TCK-${n}`,
      authorId: u.id,
      orderId,
      status: "open",
      createdAt: now,
      updatedAt: now,
      replies: [],
    };
    let next: DemoState = {
      ...state,
      tickets: [ticket, ...state.tickets],
      counters: { ...state.counters, ticket: n },
    };
    if (disputedOrder) {
      next = replaceOrderIn(next, disputedOrder);
      next = addNotification(next, disputedOrder.sellerId, `По заказу ${disputedOrder.number} открыт спор. Опишите свою позицию и приложите доказательства.`, `/support/ticket?id=${ticket.id}`);
      next = notifyAdmins(next, `Открыт спор по заказу ${disputedOrder.number}`, `/support/ticket?id=${ticket.id}`);
      next = addAudit(next, u.id, "dispute.opened", "ticket", ticket.id, `${disputedOrder.number}: ${rest.reason}`);
    } else if (rest.kind === "complaint") {
      next = notifyAdmins(next, `Новая жалоба: ${rest.subject}`, `/support/ticket?id=${ticket.id}`);
    }
    commit(next);
    return ok(ticket);
  });
}

export function replyTicket(ticketId: string, text: string, evidence = ""): Result {
  return guard(() => {
    const u = requireUser();
    const parsed = replySchema.safeParse({ text, evidence });
    if (!parsed.success) return fail(parsed.error.issues[0].message);
    const t = state.tickets.find((x) => x.id === ticketId);
    if (!t || !canAccessTicket(state, u, t)) throw new DomainError("Обращение не найдено", "not_found");
    if (["resolved", "rejected"].includes(t.status) && u.role !== "admin") return fail("Обращение закрыто");
    const now = new Date().toISOString();
    const author: Ticket["replies"][number]["authorId"] = u.role === "admin" ? "staff" : u.id;
    let next: DemoState = {
      ...state,
      tickets: state.tickets.map((x) =>
        x.id === ticketId
          ? {
              ...x,
              updatedAt: now,
              // ответ администратора переводит новое обращение в работу; ответ стороны по запросу сведений — обратно в работу
              status: u.role === "admin" && x.status === "open" ? "in_review" : u.role !== "admin" && x.status === "need_info" ? "in_review" : x.status,
              replies: [...x.replies, { id: rid("tr"), at: now, authorId: author, text: parsed.data.text, evidence: parsed.data.evidence || undefined, kind: "message" as const }],
            }
          : x,
      ),
    };
    const order = t.orderId ? state.orders.find((o) => o.id === t.orderId) : undefined;
    const recipients = new Set<string>([t.authorId]);
    if (t.kind === "dispute" && order) recipients.add(order.sellerId);
    recipients.delete(u.id);
    if (u.role === "admin") recipients.forEach((r) => (next = addNotification(next, r, `Ответ поддержки по обращению ${t.number}.`, `/support/ticket?id=${t.id}`)));
    else next = notifyAdmins(next, `Новое сообщение по обращению ${t.number}`, `/support/ticket?id=${t.id}`);
    commit(next);
    return ok();
  });
}

/** Администратор запрашивает у сторон спора дополнительные сведения. */
export function requestDisputeInfo(ticketId: string, text: string): Result {
  return guard(() => {
    const admin = requireAdmin();
    const parsed = messageSchema.safeParse({ text });
    if (!parsed.success) return fail(parsed.error.issues[0].message);
    const t = state.tickets.find((x) => x.id === ticketId);
    if (!t || t.kind !== "dispute") throw new DomainError("Спор не найден", "not_found");
    if (["resolved", "rejected"].includes(t.status)) return fail("Спор уже закрыт");
    const now = new Date().toISOString();
    let next: DemoState = {
      ...state,
      tickets: state.tickets.map((x) =>
        x.id === ticketId ? { ...x, status: "need_info" as const, updatedAt: now, replies: [...x.replies, { id: rid("tr"), at: now, authorId: "staff", text: parsed.data.text, kind: "info_request" as const }] } : x,
      ),
    };
    const order = t.orderId ? state.orders.find((o) => o.id === t.orderId) : undefined;
    [t.authorId, order?.sellerId].filter((x): x is string => !!x).forEach((uid) => (next = addNotification(next, uid, `По спору ${t.number} запрошены дополнительные сведения.`, `/support/ticket?id=${t.id}`)));
    next = addAudit(next, admin.id, "dispute.info_requested", "ticket", t.id, parsed.data.text.slice(0, 120));
    commit(next);
    return ok();
  });
}

/** Решение по спору (только администратор): возврат покупателю или завершение заказа в пользу продавца. */
export function resolveDispute(ticketId: string, input: unknown): Result {
  return guard(() => {
    const admin = requireAdmin();
    const parsed = decisionSchema.safeParse(input);
    if (!parsed.success) return fail("Проверьте форму", zodErrors(parsed.error));
    const t = state.tickets.find((x) => x.id === ticketId);
    if (!t || t.kind !== "dispute" || !t.orderId) throw new DomainError("Спор не найден", "not_found");
    if (["resolved", "rejected"].includes(t.status)) return fail("Спор уже закрыт");
    const order = state.orders.find((o) => o.id === t.orderId);
    if (!order) throw new DomainError("Заказ не найден", "not_found");
    const { decision, comment } = parsed.data;
    const t2 = transition(state, order, decision === "refund_buyer" ? "refund" : "resolve_dispute_complete", admin, `Решение по спору ${t.number}.`);
    let next = t2.s;
    const now = new Date().toISOString();
    next = {
      ...next,
      tickets: next.tickets.map((x) =>
        x.id === ticketId
          ? {
              ...x,
              status: decision === "refund_buyer" ? ("resolved" as const) : ("rejected" as const),
              updatedAt: now,
              resolution: { decision, comment, at: now, byId: admin.id },
              replies: [...x.replies, { id: rid("tr"), at: now, authorId: "staff", text: comment, kind: "decision" as const }],
            }
          : x,
      ),
    };
    const text = decision === "refund_buyer" ? "в пользу покупателя: оформлен тестовый возврат" : "в пользу продавца: заказ завершён";
    [t.authorId, order.sellerId].forEach((uid) => (next = addNotification(next, uid, `Решение по спору ${t.number} ${text}.`, `/support/ticket?id=${t.id}`)));
    next = addAudit(next, admin.id, "dispute.resolved", "ticket", t.id, `${t.number}: ${text}. ${comment.slice(0, 150)}`);
    commit(next);
    return ok();
  });
}

export function setTicketStatus(ticketId: string, status: TicketStatus): Result {
  return guard(() => {
    const admin = requireAdmin();
    const t = state.tickets.find((x) => x.id === ticketId);
    if (!t) throw new DomainError("Обращение не найдено", "not_found");
    if (t.kind === "dispute" && (status === "resolved" || status === "rejected"))
      return fail("Спор закрывается решением администратора: выберите «Принять решение»");
    let next: DemoState = {
      ...state,
      tickets: state.tickets.map((x) => (x.id === ticketId ? { ...x, status, updatedAt: new Date().toISOString() } : x)),
    };
    next = addNotification(next, t.authorId, `Статус обращения ${t.number} изменён.`, `/support/ticket?id=${t.id}`);
    next = addAudit(next, admin.id, "ticket.status", "ticket", t.id, `${t.number}: ${t.status} → ${status}`);
    commit(next);
    return ok();
  });
}

/* ───────────── уведомления ───────────── */

export function markNotificationsRead(): Result {
  return guard(() => {
    const u = requireUser();
    commit({ ...state, notifications: state.notifications.map((n) => (n.userId === u.id ? { ...n, read: true } : n)) });
    return ok();
  });
}

/* ───────────── профиль ───────────── */

const avatarSchema = z
  .string()
  .max(60_000)
  .refine((v) => /^hue:([0-9]|[1-9][0-9]|[12][0-9]{2}|3[0-5][0-9])$/.test(v) || /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(v), "Недопустимый аватар");

const profileSchema = z.object({
  username: z.string().trim().min(3, "Минимум 3 символа").max(24, "Максимум 24 символа").regex(/^[\p{L}\p{N}_.-]+$/u, "Допустимы буквы, цифры, _ . -"),
  about: z.string().trim().max(300, "Максимум 300 символов"),
  avatar: avatarSchema.optional(),
});

export function updateProfile(input: unknown): Result {
  return guard(() => {
    const u = requireUser();
    const parsed = profileSchema.safeParse(input);
    if (!parsed.success) return fail("Проверьте форму", zodErrors(parsed.error));
    if (state.profiles.some((p) => p.id !== u.id && p.username.toLowerCase() === parsed.data.username.toLowerCase()))
      return fail("Это имя уже занято", { username: "Это имя уже занято" });
    commit({
      ...state,
      profiles: state.profiles.map((p) =>
        p.id === u.id ? { ...p, username: parsed.data.username, about: parsed.data.about, avatar: parsed.data.avatar ?? p.avatar } : p,
      ),
    });
    return ok();
  });
}

/* ───────────── выплаты ───────────── */

export function balanceFor(s: DemoState, userId: string): Balance {
  return balanceOf(s.ledger, userId);
}

/** Заявка на вывод (ТЕСТ): сумма сразу резервируется из «Доступно», отрицательный баланс невозможен. */
export function requestPayout(input: unknown): Result<PayoutRequest> {
  return guard(() => {
    const u = requireSeller();
    const parsed = payoutRequestSchema.safeParse(input);
    if (!parsed.success) return fail("Проверьте форму", zodErrors(parsed.error));
    const { amountUzs, method, details } = parsed.data;
    if (looksLikeRealAccountNumber(details)) return fail("Не указывайте реальные номера карт и счетов — сейчас это тестовый режим", { details: "Укажите тестовые реквизиты, не реальные" });
    if (amountUzs < MIN_PAYOUT_UZS) return fail(`Минимальная сумма вывода — ${fmt(MIN_PAYOUT_UZS)}`, { amountUzs: `Минимум ${fmt(MIN_PAYOUT_UZS)}` });
    const bal = balanceOf(state.ledger, u.id);
    if (amountUzs > bal.available) return fail(`Недостаточно средств: доступно ${fmt(bal.available)}`, { amountUzs: "Больше доступной суммы" });
    const n = state.counters.payout + 1;
    const now = new Date().toISOString();
    const p: PayoutRequest = {
      id: rid("p"),
      number: `PAY-${n}`,
      sellerId: u.id,
      amountUzs,
      method,
      details,
      status: "created",
      adminComment: "",
      createdAt: now,
      updatedAt: now,
      history: [{ at: now, status: "created", byId: u.id, note: "Заявка создана." }],
    };
    const entry = onPayoutRequested(p, now);
    if (!isNonNegative(balanceOf([...state.ledger, entry], u.id))) return fail("Недостаточно средств");
    let next: DemoState = { ...state, payouts: [p, ...state.payouts], counters: { ...state.counters, payout: n } };
    next = addLedger(next, entry);
    next = addAudit(next, u.id, "payout.requested", "payout", p.id, `${p.number}: ${fmt(amountUzs)} (тест)`);
    next = notifyAdmins(next, `Новая заявка на вывод ${p.number}: ${fmt(amountUzs)}`, "/admin/payouts");
    commit(next);
    return ok(p);
  });
}

/** Рассмотрение заявки администратором. Продавец менять статус заявки не может. */
export function payoutAction(payoutId: string, action: PayoutAction, comment = ""): Result {
  return guard(() => {
    const admin = requireAdmin();
    const p = state.payouts.find((x) => x.id === payoutId);
    if (!p) throw new DomainError("Заявка не найдена", "not_found");
    if (action === "reject" && comment.trim().length < 3) return fail("Укажите причину отклонения");
    const updated = applyPayoutStatus(p, action, admin.id, comment.trim(), new Date());
    const at = updated.updatedAt;
    let next: DemoState = { ...state, payouts: state.payouts.map((x) => (x.id === payoutId ? updated : x)) };
    // записи леджера — один раз на заявку (защита от повторной выплаты/возврата суммы)
    if (action === "mark_paid" && !hasEntry(next.ledger, "payout_paid", { payoutId })) next = addLedger(next, onPayoutPaid(updated, at));
    if (action === "reject" && !hasEntry(next.ledger, "payout_rejected", { payoutId })) next = addLedger(next, onPayoutRejected(updated, at));
    next = addAudit(next, admin.id, `payout.${updated.status}`, "payout", payoutId, `${p.number}: ${p.status} → ${updated.status}${comment ? `. ${comment.trim()}` : ""}`);
    next = addNotification(next, p.sellerId, `Заявка ${p.number}: ${updated.status === "paid" ? "тестовая выплата отмечена" : "статус изменён"}.`, "/seller/finance");
    commit(next);
    return ok();
  });
}

/* ───────────── администрирование ───────────── */

export function setUserBlocked(userId: string, blocked: boolean): Result {
  return guard(() => {
    const admin = requireAdmin();
    if (userId === admin.id) return fail("Нельзя заблокировать себя");
    const target = state.profiles.find((p) => p.id === userId);
    if (!target) throw new DomainError("Пользователь не найден", "not_found");
    if (target.role === "admin") return fail("Нельзя заблокировать администратора");
    let next: DemoState = { ...state, profiles: state.profiles.map((p) => (p.id === userId ? { ...p, blocked } : p)) };
    next = addAudit(next, admin.id, blocked ? "user.blocked" : "user.unblocked", "profile", userId, target.username);
    commit(next);
    return ok();
  });
}

export function setSellerVerified(userId: string, verified: boolean): Result {
  return guard(() => {
    const admin = requireAdmin();
    let next: DemoState = { ...state, profiles: state.profiles.map((p) => (p.id === userId ? { ...p, verified } : p)) };
    next = addAudit(next, admin.id, verified ? "seller.verified" : "seller.unverified", "profile", userId, "");
    commit(next);
    return ok();
  });
}

/* игры */

function slugify(name: string, taken: Set<string>): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30) || "game";
  let slug = base;
  for (let i = 2; taken.has(slug); i++) slug = `${base}-${i}`;
  return slug;
}

function abbrOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const a = words.length > 1 ? words.map((w) => w[0]).join("") : name.slice(0, 2);
  return a.toUpperCase().slice(0, 3);
}

export function addGame(input: unknown): Result<Game> {
  return guard(() => {
    const admin = requireAdmin();
    const parsed = gameSchema.safeParse(input);
    if (!parsed.success) return fail("Проверьте форму", zodErrors(parsed.error));
    if (state.games.some((g) => g.name.toLowerCase() === parsed.data.name.toLowerCase())) return fail("Такая игра уже есть", { name: "Такая игра уже есть" });
    const game: Game = {
      slug: slugify(parsed.data.name, new Set(state.games.map((g) => g.slug))),
      name: parsed.data.name,
      nameUz: parsed.data.nameUz || parsed.data.name,
      nameEn: parsed.data.nameEn || parsed.data.name,
      description: parsed.data.description,
      abbr: abbrOf(parsed.data.name),
      hue: parsed.data.hue,
      enabled: true,
      sortOrder: Math.max(0, ...state.games.map((g) => g.sortOrder)) + 10,
    };
    let next: DemoState = { ...state, games: [...state.games, game] };
    next = addAudit(next, admin.id, "game.added", "game", game.slug, game.name);
    commit(next);
    return ok(game);
  });
}

export function updateGame(slug: string, input: unknown): Result {
  return guard(() => {
    const admin = requireAdmin();
    const parsed = gameSchema.safeParse(input);
    if (!parsed.success) return fail("Проверьте форму", zodErrors(parsed.error));
    if (!state.games.some((g) => g.slug === slug)) throw new DomainError("Игра не найдена", "not_found");
    let next: DemoState = {
      ...state,
      games: state.games.map((g) =>
        g.slug === slug ? { ...g, name: parsed.data.name, nameUz: parsed.data.nameUz || parsed.data.name, nameEn: parsed.data.nameEn || parsed.data.name, description: parsed.data.description, hue: parsed.data.hue } : g,
      ),
    };
    next = addAudit(next, admin.id, "game.updated", "game", slug, parsed.data.name);
    commit(next);
    return ok();
  });
}

export function setGameEnabled(slug: string, enabled: boolean): Result {
  return guard(() => {
    const admin = requireAdmin();
    if (!state.games.some((g) => g.slug === slug)) throw new DomainError("Игра не найдена", "not_found");
    let next: DemoState = { ...state, games: state.games.map((g) => (g.slug === slug ? { ...g, enabled } : g)) };
    next = addAudit(next, admin.id, enabled ? "game.enabled" : "game.disabled", "game", slug, "");
    commit(next);
    return ok();
  });
}

export function deleteGame(slug: string): Result {
  return guard(() => {
    const admin = requireAdmin();
    if (state.listings.some((l) => l.gameSlug === slug) || state.orders.some((o) => o.gameSlug === slug))
      return fail("Нельзя удалить игру, по которой есть объявления или заказы — отключите её");
    let next: DemoState = { ...state, games: state.games.filter((g) => g.slug !== slug) };
    next = addAudit(next, admin.id, "game.deleted", "game", slug, "");
    commit(next);
    return ok();
  });
}

/* комиссии и настройки */

export function updateCommissionSettings(input: unknown): Result {
  return guard(() => {
    const admin = requireAdmin();
    const parsed = commissionSettingsSchema.safeParse(input);
    if (!parsed.success) return fail("Проверьте форму", zodErrors(parsed.error));
    const old = state.commission;
    let next: DemoState = { ...state, commission: { ...old, ...parsed.data } };
    next = addAudit(
      next,
      admin.id,
      "commission.updated",
      "settings",
      "commission",
      `${old.defaultPercent}% → ${parsed.data.defaultPercent}%; платит: ${old.payer} → ${parsed.data.payer}; минимум ${old.minFeeEnabled ? old.minFeeUzs : "выкл"} → ${parsed.data.minFeeEnabled ? parsed.data.minFeeUzs : "выкл"}; лимиты ${old.minOrderUzs}–${old.maxOrderUzs} → ${parsed.data.minOrderUzs}–${parsed.data.maxOrderUzs}. Старые заказы не меняются.`,
    );
    commit(next);
    return ok();
  });
}

/** Особая ставка для игры (percent = null — убрать, вернуться к общей). */
export function setGamePercent(slug: string, percent: number | null): Result {
  return guard(() => {
    const admin = requireAdmin();
    if (!state.games.some((g) => g.slug === slug)) throw new DomainError("Игра не найдена", "not_found");
    let gamePercent = { ...state.commission.gamePercent };
    if (percent === null) delete gamePercent[slug];
    else {
      const p = percentOverrideSchema.safeParse(percent);
      if (!p.success) return fail(p.error.issues[0].message);
      gamePercent = { ...gamePercent, [slug]: p.data };
    }
    let next: DemoState = { ...state, commission: { ...state.commission, gamePercent } };
    next = addAudit(next, admin.id, "commission.game_percent", "settings", slug, percent === null ? "ставка игры снята" : `Ставка для игры ${slug}: ${percent}%`);
    commit(next);
    return ok();
  });
}

/** Индивидуальная ставка продавца (percent = null — убрать). */
export function setSellerPercent(userId: string, percent: number | null): Result {
  return guard(() => {
    const admin = requireAdmin();
    const target = state.profiles.find((p) => p.id === userId && p.isSeller);
    if (!target) throw new DomainError("Продавец не найден", "not_found");
    let sellerPercent = { ...state.commission.sellerPercent };
    if (percent === null) delete sellerPercent[userId];
    else {
      const p = percentOverrideSchema.safeParse(percent);
      if (!p.success) return fail(p.error.issues[0].message);
      sellerPercent = { ...sellerPercent, [userId]: p.data };
    }
    let next: DemoState = { ...state, commission: { ...state.commission, sellerPercent } };
    next = addAudit(next, admin.id, "commission.seller_percent", "settings", userId, percent === null ? `${target.username}: индивидуальная ставка снята` : `${target.username}: ${percent}%`);
    commit(next);
    return ok();
  });
}

export function setModerationEnabled(enabled: boolean): Result {
  return guard(() => {
    const admin = requireAdmin();
    let next: DemoState = { ...state, settings: { ...state.settings, moderationEnabled: enabled } };
    next = addAudit(next, admin.id, "settings.moderation", "settings", "moderation", enabled ? "модерация включена" : "модерация выключена");
    commit(next);
    return ok();
  });
}

export { DEFAULT_COMMISSION };
