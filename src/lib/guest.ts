"use client";

import { useSyncExternalStore } from "react";

/**
 * Локальные данные гостя: избранное и недавно просмотренные товары.
 * Хранятся только в этом браузере (localStorage) — между устройствами не синхронизируются.
 * После входа гостевое избранное объединяется с аккаунтом без дубликатов.
 */

const FAV_KEY = "uzmarket.guest.favorites";
const RECENT_KEY = "uzmarket.recent";
const RECENT_MAX = 12;
const EMPTY: string[] = [];

type Store = { cache: string[] | null; raw: string | null; listeners: Set<() => void> };
const stores: Record<string, Store> = {};

function st(key: string): Store {
  return (stores[key] ??= { cache: null, raw: null, listeners: new Set() });
}

function read(key: string): string[] {
  if (typeof window === "undefined") return EMPTY;
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(key);
  } catch {
    return EMPTY;
  }
  const s = st(key);
  if (s.cache && s.raw === raw) return s.cache;
  let list: string[] = EMPTY;
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) list = parsed.filter((x): x is string => typeof x === "string").slice(0, 200);
  } catch {
    list = EMPTY;
  }
  s.cache = list;
  s.raw = raw;
  return list;
}

function write(key: string, list: string[]) {
  try {
    window.localStorage.setItem(key, JSON.stringify(list));
  } catch {
    /* хранилище недоступно — просто не сохраняем */
  }
  st(key).listeners.forEach((l) => l());
}

function useList(key: string): string[] {
  return useSyncExternalStore(
    (cb) => {
      const s = st(key);
      s.listeners.add(cb);
      const onStorage = (e: StorageEvent) => {
        if (e.key === key) cb();
      };
      window.addEventListener("storage", onStorage);
      return () => {
        s.listeners.delete(cb);
        window.removeEventListener("storage", onStorage);
      };
    },
    () => read(key),
    () => EMPTY,
  );
}

export const useGuestFavorites = () => useList(FAV_KEY);
export const useRecentlyViewed = () => useList(RECENT_KEY);

export function toggleGuestFavorite(listingId: string): boolean {
  const cur = read(FAV_KEY);
  const has = cur.includes(listingId);
  write(FAV_KEY, has ? cur.filter((x) => x !== listingId) : [...cur, listingId]);
  return !has;
}

/** Забирает гостевое избранное (и очищает его) — вызывается при входе/регистрации. */
export function takeGuestFavorites(): string[] {
  const cur = read(FAV_KEY);
  if (cur.length) write(FAV_KEY, []);
  return cur;
}

export function pushRecentlyViewed(listingId: string) {
  const cur = read(RECENT_KEY);
  if (cur[0] === listingId) return;
  write(RECENT_KEY, [listingId, ...cur.filter((x) => x !== listingId)].slice(0, RECENT_MAX));
}
