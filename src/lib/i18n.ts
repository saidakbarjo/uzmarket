"use client";

import { useSyncExternalStore } from "react";

export type Lang = "ru" | "uz";
const KEY = "uzmarket.lang";
const listeners = new Set<() => void>();

function read(): Lang {
  if (typeof window === "undefined") return "ru";
  try {
    return window.localStorage.getItem(KEY) === "uz" ? "uz" : "ru";
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
  "nav.catalog": { ru: "Каталог", uz: "Katalog" },
  "nav.sell": { ru: "Продать товар", uz: "Tovar sotish" },
  "nav.login": { ru: "Войти", uz: "Kirish" },
  "nav.register": { ru: "Регистрация", uz: "Ro‘yxatdan o‘tish" },
  "nav.support": { ru: "Поддержка", uz: "Yordam" },
  "nav.account": { ru: "Кабинет", uz: "Kabinet" },
  "nav.logout": { ru: "Выйти", uz: "Chiqish" },
  "search.placeholder": { ru: "Поиск товаров и услуг…", uz: "Tovar va xizmatlarni qidiring…" },
  "hero.title": { ru: "Цифровые товары и услуги Узбекистана в одном месте", uz: "O‘zbekistondagi raqamli tovar va xizmatlar bir joyda" },
  "hero.subtitle": {
    ru: "Игровая валюта, ключи, подписки, дизайн и многое другое. Цены в сумах, общение с продавцом и понятный статус каждой сделки.",
    uz: "O‘yin valyutasi, kalitlar, obunalar, dizayn va boshqalar. Narxlar so‘mda, sotuvchi bilan muloqot va har bir bitimning aniq holati.",
  },
  "hero.cta": { ru: "Открыть каталог", uz: "Katalogni ochish" },
  "section.popularCategories": { ru: "Популярные категории", uz: "Mashhur toifalar" },
  "section.popular": { ru: "Популярные товары", uz: "Mashhur tovarlar" },
  "section.recent": { ru: "Недавно добавленные", uz: "Yaqinda qo‘shilganlar" },
  "section.how": { ru: "Как это работает", uz: "Bu qanday ishlaydi" },
  "section.faq": { ru: "Частые вопросы", uz: "Ko‘p so‘raladigan savollar" },
  "demo.banner": { ru: "DEMO — реальные деньги не переводятся", uz: "DEMO — haqiqiy pul o‘tkazilmaydi" },
  "footer.legal": { ru: "Юридическая информация", uz: "Huquqiy ma’lumot" },
} as const;

export type DictKey = keyof typeof dict;

export function tr(lang: Lang, key: DictKey): string {
  return dict[key][lang];
}

export function useT() {
  const lang = useLang();
  return (key: DictKey) => tr(lang, key);
}
