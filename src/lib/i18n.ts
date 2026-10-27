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
  "hero.title": { ru: "Игровой рынок Узбекистана", uz: "O‘zbekiston o‘yin bozori", en: "Uzbekistan's gaming market" },
  "hero.subtitle": {
    ru: "Скины, валюта и услуги по девяти играм. Цены в сумах, комиссия и итог видны до оформления заказа.",
    uz: "To‘qqizta o‘yin bo‘yicha skinlar, valyuta va xizmatlar. Narxlar so‘mda, komissiya va yakuniy summa buyurtmadan oldin ko‘rinadi.",
    en: "Skins, currency and services for nine games. Prices in UZS; the commission and total are shown before you order.",
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
