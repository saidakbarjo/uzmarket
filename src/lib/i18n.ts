"use client";

import { useSyncExternalStore } from "react";

export type Lang = "ru" | "uz" | "en";
export const LANGS: Lang[] = ["ru", "uz", "en"];
const KEY = "uzmarket.lang";
const listeners = new Set<() => void>();

function read(): Lang {
  if (typeof window === "undefined") return "ru";
  try {
    const v = window.localStorage.getItem(KEY);
    return v === "uz" || v === "en" ? v : "ru";
  } catch {
    return "ru";
  }
}

export function setLang(lang: Lang) {
  try {
    window.localStorage.setItem(KEY, lang);
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}

export function useLang(): Lang {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    read,
    () => "ru" as Lang,
  );
}

/** Основной язык интерфейса — русский. Узбекский — дополнительный (ключевые элементы). */
const dict = {
  "nav.catalog": { ru: "Каталог", uz: "Katalog", en: "Catalog" },
  "nav.sell": { ru: "Продать товар", uz: "Tovar sotish", en: "Sell" },
  "nav.login": { ru: "Войти", uz: "Kirish", en: "Log in" },
  "nav.register": { ru: "Регистрация", uz: "Ro‘yxatdan o‘tish", en: "Sign up" },
  "nav.support": { ru: "Поддержка", uz: "Yordam", en: "Support" },
  "nav.account": { ru: "Кабинет", uz: "Kabinet", en: "Account" },
  "nav.logout": { ru: "Выйти", uz: "Chiqish", en: "Log out" },
  "search.placeholder": { ru: "Поиск скинов, валюты, услуг…", uz: "Skin, valyuta, xizmatlarni qidiring…", en: "Search skins, currency, services…" },
  "hero.title": { ru: "Игровой маркетплейс Узбекистана: продавцы, скины, валюта и услуги", uz: "O‘zbekiston o‘yin bozori: sotuvchilar, skinlar, valyuta va xizmatlar", en: "Uzbekistan's gaming marketplace: sellers, skins, currency and services" },
  "hero.subtitle": {
    ru: "CS2, PUBG, Roblox, Minecraft, Fortnite, Brawl Stars, Standoff 2, Valorant. Цены в сумах, прозрачная комиссия и понятный статус каждого заказа.",
    uz: "CS2, PUBG, Roblox, Minecraft, Fortnite, Brawl Stars, Standoff 2, Valorant. Narxlar so‘mda, shaffof komissiya va har bir buyurtmaning aniq holati.",
    en: "CS2, PUBG, Roblox, Minecraft, Fortnite, Brawl Stars, Standoff 2, Valorant. Prices in UZS, transparent commission and a clear status for every order.",
  },
  "hero.cta": { ru: "Открыть каталог", uz: "Katalogni ochish", en: "Browse catalog" },
  "section.popularCategories": { ru: "Игры", uz: "O‘yinlar", en: "Games" },
  "section.popular": { ru: "Популярные товары", uz: "Mashhur tovarlar", en: "Popular listings" },
  "section.recent": { ru: "Недавно добавленные", uz: "Yaqinda qo‘shilganlar", en: "Recently added" },
  "section.how": { ru: "Как это работает", uz: "Bu qanday ishlaydi", en: "How it works" },
  "section.faq": { ru: "Частые вопросы", uz: "Ko‘p so‘raladigan savollar", en: "FAQ" },
  "demo.banner": { ru: "DEMO — реальные деньги не переводятся", uz: "DEMO — haqiqiy pul o‘tkazilmaydi", en: "DEMO — no real money is transferred" },
  "footer.legal": { ru: "Юридическая информация", uz: "Huquqiy ma’lumot", en: "Legal" },
} as const;

export type DictKey = keyof typeof dict;

export function tr(lang: Lang, key: DictKey): string {
  return dict[key][lang];
}

export function useT() {
  const lang = useLang();
  return (key: DictKey) => tr(lang, key);
}
