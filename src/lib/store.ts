"use client";

import { useSyncExternalStore } from "react";
import { z } from "zod";
import { calcFee } from "@/lib/money";
import {
  DEMO_PASSWORD,
  seedListings,
  seedProfiles,
  seedReviews,
} from "@/lib/data/seed";
import { seedNotifications, seedOrders, seedTickets } from "@/lib/data/seed-orders";
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
import type {
  AppNotification,
  CategorySlug,
  Listing,
  ListingStatus,
  Order,
  Profile,
  Review,
  Ticket,
  TicketStatus,
} from "@/lib/types";
import {
  type FieldErrors,
  listingSchema,
  loginSchema,
  messageSchema,
  registerSchema,
  reviewSchema,
  ticketSchema,
  zodErrors,
} from "@/lib/validation";

/**
 * ДЕМО-хранилище. Все данные живут в localStorage браузера.
 * Это НЕ защищённая система: пользователь с DevTools может изменить данные.
 * Поэтому настоящая авторизация и права будут реализованы через Supabase Auth + RLS.
 * Тем не менее все действия ниже проверяют права по текущей сессии (а не по параметрам из UI)
 * и используют доменные правила из orders-domain.ts, пригодные для переноса на сервер.
 */

const STORAGE_KEY = "uzmarket.demo.v1";
const VERSION = 1;

export interface Credential {
  salt: string;
  hash: string;
}

export interface DemoState {
  version: number;
  profiles: Profile[];
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
  disabledCategories: CategorySlug[];
  counters: { order: number; ticket: number };
}

function seedState(): DemoState {
  return {
    version: VERSION,
    profiles: seedProfiles,
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
    disabledCategories: [],
    counters: { order: 100300, ticket: 5100 },
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

function persist() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* переполнено хранилище или приватный режим */
  }
}

function emit() {
  listeners.forEach((l) => l());
}

function setState(fn: (s: DemoState) => DemoState) {
  load();
  state = fn(state);
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

function guard<T>(fn: () => Result<T>): Result<T> {
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

function pushNotification(userId: string, text: string, href?: string) {
  const n: AppNotification = { id: rid("n"), userId, text, at: new Date().toISOString(), read: false, href };
  state = { ...state, notifications: [n, ...state.notifications].slice(0, 200) };
}

function replaceOrder(updated: Order) {
  state = { ...state, orders: state.orders.map((o) => (o.id === updated.id ? updated : o)) };
}

function findOrderFor(actor: Profile, orderId: string): Order {
  const o = state.orders.find((x) => x.id === orderId);
  if (!o || !canView(o, actor)) throw new DomainError("Заказ не найден", "not_found");
  return o;
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
  };
  setState((s) => ({
    ...s,
    profiles: [...s.profiles, profile],
    credentials: { ...s.credentials, [email]: { salt, hash } },
    session: { userId: profile.id },
  }));
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

  setState((s) => ({ ...s, session: { userId: profile.id } }));
  return ok(profile);
}

export function logout() {
  setState((s) => ({ ...s, session: null }));
}

export function resetDemoData() {
  const fresh = seedState();
  setState(() => fresh);
}

/* ───────────── избранное ───────────── */

export function toggleFavorite(listingId: string): Result<{ favorited: boolean }> {
  return guard(() => {
    const u = requireUser();
    if (!state.listings.some((l) => l.id === listingId)) throw new DomainError("Объявление не найдено", "not_found");
    const cur = state.favorites[u.id] ?? [];
    const has = cur.includes(listingId);
    const next = has ? cur.filter((x) => x !== listingId) : [...cur, listingId];
    setState((s) => ({ ...s, favorites: { ...s.favorites, [u.id]: next } }));
    return ok({ favorited: !has });
  });
}

/* ───────────── объявления ───────────── */

export function createListing(input: unknown): Result<Listing> {
  return guard(() => {
    const u = requireUser();
    const parsed = listingSchema.safeParse(input);
    if (!parsed.success) return fail("Проверьте форму", zodErrors(parsed.error));
    if (state.disabledCategories.includes(parsed.data.categorySlug)) return fail("Эта категория временно отключена");
    const listing: Listing = {
      ...parsed.data,
      id: rid("l"),
      sellerId: u.id, // продавец берётся из сессии, а не из формы
      status: "active",
      isDemo: false,
      views: 0,
      createdAt: new Date().toISOString(),
    };
    setState((s) => ({
      ...s,
      listings: [listing, ...s.listings],
      profiles: s.profiles.map((p) => (p.id === u.id ? { ...p, isSeller: true } : p)),
    }));
    return ok(listing);
  });
}

export function updateListing(id: string, input: unknown): Result<Listing> {
  return guard(() => {
    const u = requireUser();
    const existing = state.listings.find((l) => l.id === id);
    if (!existing) throw new DomainError("Объявление не найдено", "not_found");
    if (existing.sellerId !== u.id && u.role !== "admin") throw new DomainError("Нельзя менять чужое объявление", "forbidden");
    const parsed = listingSchema.safeParse(input);
    if (!parsed.success) return fail("Проверьте форму", zodErrors(parsed.error));
    // sellerId, status, createdAt не берутся из формы; цена в уже созданных заказах не меняется
    const updated: Listing = { ...existing, ...parsed.data };
    setState((s) => ({ ...s, listings: s.listings.map((l) => (l.id === id ? updated : l)) }));
    return ok(updated);
  });
}

export function setListingStatus(id: string, status: ListingStatus): Result {
  return guard(() => {
    const u = requireUser();
    const l = state.listings.find((x) => x.id === id);
    if (!l) throw new DomainError("Объявление не найдено", "not_found");
    const isOwner = l.sellerId === u.id;
    if (status === "blocked") requireAdmin();
    else if (!isOwner && u.role !== "admin") throw new DomainError("Нельзя менять чужое объявление", "forbidden");
    if (l.status === "blocked" && u.role !== "admin") throw new DomainError("Объявление заблокировано модератором", "forbidden");
    setState((s) => ({ ...s, listings: s.listings.map((x) => (x.id === id ? { ...x, status } : x)) }));
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
      (o) => o.listingId === id && ["pending_payment", "paid", "in_progress", "delivered", "disputed"].includes(o.status),
    );
    if (active) return fail("Есть незавершённые заказы — сначала завершите или отмените их");
    setState((s) => ({ ...s, listings: s.listings.filter((x) => x.id !== id) }));
    return ok();
  });
}

/* ───────────── заказы ───────────── */

export function createOrder(listingId: string): Result<Order> {
  return guard(() => {
    const u = requireUser();
    const l = state.listings.find((x) => x.id === listingId);
    if (!l || l.status !== "active") throw new DomainError("Объявление недоступно", "not_found");
    const seller = state.profiles.find((p) => p.id === l.sellerId);
    if (!seller || seller.blocked) throw new DomainError("Продавец недоступен", "not_found");
    if (l.sellerId === u.id) return fail("Нельзя купить собственный товар");

    const now = new Date().toISOString();
    const n = state.counters.order + 1;
    const order: Order = {
      id: rid("o"),
      number: `UZM-${n}`,
      listingId: l.id,
      listingTitle: l.title,
      buyerId: u.id,
      sellerId: l.sellerId,
      priceUzs: l.priceUzs, // цена фиксируется из хранилища на момент создания
      feeUzs: calcFee(l.priceUzs),
      status: "pending_payment",
      createdAt: now,
      updatedAt: now,
      events: [{ id: rid("ev"), at: now, status: "pending_payment", actorId: u.id, note: "Заказ создан. Ожидает тестовой оплаты." }],
      messages: [],
      isDemo: true,
    };
    setState((s) => ({ ...s, orders: [order, ...s.orders], counters: { ...s.counters, order: n } }));
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
        amountUzs: order.priceUzs,
        feeUzs: order.feeUzs,
        idempotencyKey: `${orderId}:pay:${attempt}`,
      });
    }
    const event = makeEvent(intent.id, OUTCOME_TO_EVENT[outcome]);
    const res = demoPayments.handleEvent(intent, event, new Set(state.processedEvents));
    if (!res.applied) return fail("Платёж уже обработан");

    const action: OrderAction = outcome === "success" ? "pay_success" : outcome === "fail" ? "pay_fail" : "cancel";
    const updated = applyAction(order, action, u);
    const exists = state.intents.some((i) => i.id === intent!.id);
    setState((s) => ({
      ...s,
      intents: exists ? s.intents.map((i) => (i.id === res.intent.id ? res.intent : i)) : [...s.intents, res.intent],
      processedEvents: [...s.processedEvents, event.eventId],
      lastEvents: { ...s.lastEvents, [orderId]: event },
    }));
    replaceOrder(updated);
    if (outcome === "success") pushNotification(order.sellerId, `Заказ ${order.number} оплачен (тест). Приступайте к выполнению.`, `/orders?id=${order.id}`);
    persist();
    emit();
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
            : "Повторное уведомление платёжного провайдера проигнорировано (идемпотентность): статус не изменился.",
        },
      ],
    };
    replaceOrder(updated);
    persist();
    emit();
    return ok({ applied: res.applied });
  });
}

export function orderAction(orderId: string, action: OrderAction, note?: string): Result<Order> {
  return guard(() => {
    const u = requireUser();
    if (action === "pay_success" || action === "pay_fail") throw new DomainError("Оплата выполняется через платёжный модуль", "forbidden");
    if (action === "open_dispute") throw new DomainError("Спор открывается через форму обращения", "forbidden");
    const order = findOrderFor(u, orderId);
    if (action === "deliver" && !order.fulfillmentNote) {
      return fail("Сначала заполните информацию о выполнении заказа");
    }
    const updated = applyAction(order, action, u, new Date(), note);

    // возврат в тестовом режиме — через провайдер
    if (action === "refund") {
      const intent = [...state.intents].reverse().find((i) => i.orderId === orderId && i.status === "succeeded");
      if (intent) {
        const refunded = demoPayments.refund(intent);
        setState((s) => ({ ...s, intents: s.intents.map((i) => (i.id === refunded.id ? refunded : i)) }));
      }
    }
    replaceOrder(updated);
    const other = u.id === order.buyerId ? order.sellerId : order.buyerId;
    const labels: Partial<Record<OrderAction, string>> = {
      start: "Продавец приступил к выполнению",
      deliver: "Продавец выдал заказ — подтвердите получение",
      confirm: "Покупатель подтвердил получение",
      open_dispute: "Открыт спор",
      cancel: "Заказ отменён",
      refund: "Оформлен тестовый возврат",
      resolve_dispute_complete: "Спор решён: заказ завершён",
    };
    if (labels[action]) {
      pushNotification(other, `${order.number}: ${labels[action]}.`, `/orders?id=${order.id}`);
      if (u.role === "admin") pushNotification(order.buyerId === other ? order.sellerId : order.buyerId, `${order.number}: ${labels[action]}.`, `/orders?id=${order.id}`);
    }
    if (action === "confirm") {
      setState((s) => ({
        ...s,
        profiles: s.profiles.map((p) => (p.id === order.sellerId ? { ...p, salesCount: p.salesCount + 1 } : p)),
      }));
    }
    persist();
    emit();
    return ok(updated);
  });
}

export function sendOrderMessage(orderId: string, text: string): Result {
  return guard(() => {
    const u = requireUser();
    const parsed = messageSchema.safeParse({ text });
    if (!parsed.success) return fail(parsed.error.issues[0].message);
    const order = findOrderFor(u, orderId);
    const updated = addMessage(order, u, parsed.data.text);
    replaceOrder(updated);
    const other = u.id === order.buyerId ? order.sellerId : order.buyerId;
    if (u.role !== "admin") pushNotification(other, `Новое сообщение в заказе ${order.number}.`, `/orders?id=${order.id}`);
    persist();
    emit();
    return ok();
  });
}

export function saveFulfillment(orderId: string, note: string): Result {
  return guard(() => {
    const u = requireUser();
    const order = findOrderFor(u, orderId);
    replaceOrder(setFulfillmentNote(order, u, note));
    persist();
    emit();
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
    setState((s) => ({
      ...s,
      reviews: [review, ...s.reviews],
      profiles: s.profiles.map((p) => {
        if (p.id !== order.sellerId) return p;
        const total = p.rating * p.reviewsCount + review.rating;
        const count = p.reviewsCount + 1;
        return { ...p, reviewsCount: count, rating: Math.round((total / count) * 10) / 10 };
      }),
    }));
    pushNotification(order.sellerId, `Новый отзыв по заказу ${order.number}: ${review.rating}/5.`, `/listing?id=${order.listingId}`);
    persist();
    emit();
    return ok(review);
  });
}

export function setReviewHidden(reviewId: string, hidden: boolean): Result {
  return guard(() => {
    requireAdmin();
    setState((s) => ({
      ...s,
      hiddenReviewIds: hidden ? [...new Set([...s.hiddenReviewIds, reviewId])] : s.hiddenReviewIds.filter((x) => x !== reviewId),
    }));
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
    if (rest.kind === "dispute") {
      if (!orderId) return fail("Для спора выберите заказ", { orderId: "Выберите заказ" });
    }
    let disputedOrder: Order | null = null;
    if (orderId) {
      const o = state.orders.find((x) => x.id === orderId);
      if (!o || (o.buyerId !== u.id && o.sellerId !== u.id)) throw new DomainError("Заказ не найден", "not_found");
      if (rest.kind === "dispute") {
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
    setState((s) => ({
      ...s,
      tickets: [ticket, ...s.tickets],
      counters: { ...s.counters, ticket: n },
      orders: disputedOrder ? s.orders.map((o) => (o.id === disputedOrder!.id ? disputedOrder! : o)) : s.orders,
    }));
    if (disputedOrder) {
      pushNotification(disputedOrder.sellerId, `По заказу ${disputedOrder.number} открыт спор.`, `/orders?id=${disputedOrder.id}`);
      persist();
      emit();
    }
    return ok(ticket);
  });
}

export function replyTicket(ticketId: string, text: string): Result {
  return guard(() => {
    const u = requireUser();
    const parsed = messageSchema.safeParse({ text });
    if (!parsed.success) return fail(parsed.error.issues[0].message);
    const t = state.tickets.find((x) => x.id === ticketId);
    if (!t || (t.authorId !== u.id && u.role !== "admin")) throw new DomainError("Обращение не найдено", "not_found");
    if (["resolved", "rejected"].includes(t.status) && u.role !== "admin") return fail("Обращение закрыто");
    const now = new Date().toISOString();
    const author: Ticket["replies"][number]["authorId"] = u.role === "admin" ? "staff" : u.id;
    setState((s) => ({
      ...s,
      tickets: s.tickets.map((x) =>
        x.id === ticketId
          ? {
              ...x,
              updatedAt: now,
              // ответ администратора переводит новое обращение в работу
              status: u.role === "admin" && x.status === "open" ? "in_review" : x.status,
              replies: [...x.replies, { id: rid("tr"), at: now, authorId: author, text: parsed.data.text }],
            }
          : x,
      ),
    }));
    if (u.role === "admin") pushNotification(t.authorId, `Ответ поддержки по обращению ${t.number}.`, `/support/ticket?id=${t.id}`);
    return ok();
  });
}

export function setTicketStatus(ticketId: string, status: TicketStatus): Result {
  return guard(() => {
    requireAdmin();
    const t = state.tickets.find((x) => x.id === ticketId);
    if (!t) throw new DomainError("Обращение не найдено", "not_found");
    setState((s) => ({
      ...s,
      tickets: s.tickets.map((x) => (x.id === ticketId ? { ...x, status, updatedAt: new Date().toISOString() } : x)),
    }));
    pushNotification(t.authorId, `Статус обращения ${t.number} изменён.`, `/support/ticket?id=${t.id}`);
    persist();
    emit();
    return ok();
  });
}

/* ───────────── уведомления ───────────── */

export function markNotificationsRead(): Result {
  return guard(() => {
    const u = requireUser();
    setState((s) => ({ ...s, notifications: s.notifications.map((n) => (n.userId === u.id ? { ...n, read: true } : n)) }));
    return ok();
  });
}

/* ───────────── профиль и админ ───────────── */

const profileSchema = z.object({
  username: z.string().trim().min(3, "Минимум 3 символа").max(24, "Максимум 24 символа").regex(/^[\p{L}\p{N}_.-]+$/u, "Допустимы буквы, цифры, _ . -"),
  about: z.string().trim().max(300, "Максимум 300 символов"),
});

export function updateProfile(input: unknown): Result {
  return guard(() => {
    const u = requireUser();
    const parsed = profileSchema.safeParse(input);
    if (!parsed.success) return fail("Проверьте форму", zodErrors(parsed.error));
    if (state.profiles.some((p) => p.id !== u.id && p.username.toLowerCase() === parsed.data.username.toLowerCase()))
      return fail("Это имя уже занято", { username: "Это имя уже занято" });
    setState((s) => ({
      ...s,
      profiles: s.profiles.map((p) => (p.id === u.id ? { ...p, username: parsed.data.username, about: parsed.data.about } : p)),
    }));
    return ok();
  });
}

export function setUserBlocked(userId: string, blocked: boolean): Result {
  return guard(() => {
    const admin = requireAdmin();
    if (userId === admin.id) return fail("Нельзя заблокировать себя");
    const target = state.profiles.find((p) => p.id === userId);
    if (!target) throw new DomainError("Пользователь не найден", "not_found");
    if (target.role === "admin") return fail("Нельзя заблокировать администратора");
    setState((s) => ({ ...s, profiles: s.profiles.map((p) => (p.id === userId ? { ...p, blocked } : p)) }));
    return ok();
  });
}

export function setSellerVerified(userId: string, verified: boolean): Result {
  return guard(() => {
    requireAdmin();
    setState((s) => ({ ...s, profiles: s.profiles.map((p) => (p.id === userId ? { ...p, verified } : p)) }));
    return ok();
  });
}

export function setCategoryEnabled(slug: CategorySlug, enabled: boolean): Result {
  return guard(() => {
    requireAdmin();
    setState((s) => ({
      ...s,
      disabledCategories: enabled ? s.disabledCategories.filter((c) => c !== slug) : [...new Set([...s.disabledCategories, slug])],
    }));
    return ok();
  });
}
