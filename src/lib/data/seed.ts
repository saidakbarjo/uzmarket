import type { Category, Listing, Profile, Review } from "@/lib/types";

export const DEMO_PASSWORD = "demo12345"; // публичный тестовый пароль демо-аккаунтов
export const FOUNDER_USERNAME = "Saidakbar";

export const categories: Category[] = [
  { slug: "game-items", name: "Игровые товары", nameUz: "O‘yin buyumlari", description: "Предметы, наборы, скины и бонусы", icon: "Gamepad2", hue: 265 },
  { slug: "game-currency", name: "Игровая валюта", nameUz: "O‘yin valyutasi", description: "Кристаллы, монеты, донат-валюта", icon: "Coins", hue: 45 },
  { slug: "game-services", name: "Игровые услуги", nameUz: "O‘yin xizmatlari", description: "Буст, обучение, прохождение", icon: "Swords", hue: 350 },
  { slug: "keys", name: "Цифровые ключи", nameUz: "Raqamli kalitlar", description: "Ключи активации игр и программ", icon: "KeyRound", hue: 190 },
  { slug: "software", name: "Программное обеспечение", nameUz: "Dasturiy ta’minot", description: "Лицензии, утилиты, шаблоны", icon: "AppWindow", hue: 220 },
  { slug: "subscriptions", name: "Подписки", nameUz: "Obunalar", description: "Музыка, видео, сервисы", icon: "Repeat", hue: 305 },
  { slug: "accounts", name: "Цифровые аккаунты", nameUz: "Raqamli akkauntlar", description: "Только если это разрешено правилами сервиса", icon: "UserRound", hue: 160 },
  { slug: "design", name: "Дизайн и цифровые услуги", nameUz: "Dizayn va raqamli xizmatlar", description: "Логотипы, сайты, боты, монтаж", icon: "Palette", hue: 20 },
  { slug: "other", name: "Прочие цифровые товары", nameUz: "Boshqa raqamli tovarlar", description: "Курсы, шаблоны, файлы", icon: "Package", hue: 100 },
];

const BASE = new Date("2026-10-01T09:00:00Z").getTime();
const day = 86_400_000;
const iso = (daysAgo: number, hours = 0) => new Date(BASE - daysAgo * day - hours * 3_600_000).toISOString();

function seller(
  id: string,
  username: string,
  about: string,
  rating: number,
  reviewsCount: number,
  salesCount: number,
  daysAgo: number,
  extra: Partial<Profile> = {},
): Profile {
  return {
    id,
    username,
    email: `${id}@uzmarket.demo`,
    role: "user",
    isSeller: true,
    isDemo: true,
    blocked: false,
    createdAt: iso(daysAgo),
    rating,
    reviewsCount,
    salesCount,
    verified: rating >= 4.7,
    about,
    ...extra,
  };
}

export const seedProfiles: Profile[] = [
  seller("u-founder", FOUNDER_USERNAME, "Основатель и руководитель UZMARKET. Тестовый профиль администратора для демо-режима.", 5, 0, 0, 120, {
    role: "admin",
    isSeller: false,
    verified: true,
    email: "saidakbar@uzmarket.demo",
  }),
  seller("u-nur", "NurGameShop", "Игровая валюта и наборы для мобильных игр. Тестовый профиль.", 4.9, 148, 412, 300),
  seller("u-dilya", "DilyaDesign", "Логотипы, баннеры, оформление каналов. Тестовый профиль.", 4.8, 64, 133, 210),
  seller("u-timur", "TimurKeys", "Ключи активации и лицензии. Тестовый профиль.", 4.6, 92, 267, 260),
  seller("u-aziza", "AzizaSub", "Подписки и семейные тарифы. Тестовый профиль.", 4.7, 71, 190, 180),
  seller("u-bek", "BekCoach", "Тренер по соревновательным играм. Тестовый профиль.", 4.5, 38, 77, 150),
  seller("u-jasur", "JasurDev", "Боты, сайты, автоматизация. Тестовый профиль.", 4.9, 53, 98, 240),
  seller("u-malika", "MalikaFiles", "Шаблоны, пресеты, обучающие материалы. Тестовый профиль.", 4.4, 29, 61, 120),
];

type L = Omit<Listing, "status" | "isDemo" | "views" | "createdAt" | "refundTerms" | "fulfillmentTerms"> & {
  ago: number;
  refund?: string;
  fulfil?: string;
};

const R_STD = "Возврат возможен до начала выполнения. После передачи товара — только через спор, если товар не соответствует описанию.";
const R_KEY = "Ключ не подошёл или уже использован — откройте спор в течение 24 часов после получения.";
const R_SVC = "Если услуга не выполнена в срок или выполнена не по описанию — откройте спор. Частичный возврат по согласованию сторон.";
const F_STD = "Продавец передаёт товар через чат заказа и отмечает заказ как «Выдан». Покупатель подтверждает получение.";

const raw: L[] = [
  { id: "l-001", title: "Игровая валюта: 6 500 кристаллов для мобильной игры", description: "Пополнение игрового баланса без передачи пароля: нужен только игровой ID. Выполняется вручную продавцом, чаще всего за 10–15 минут. Подходит для серверов Европа и Азия.", categorySlug: "game-currency", priceUzs: 289_000, sellerId: "u-nur", deliveryMethod: "manual", deliveryDays: 0, ago: 2 },
  { id: "l-002", title: "Набор «Стартовый воин» для мобильной RPG", description: "Игровой набор с экипировкой и расходниками для старта. Передача через официальный магазин предметов по вашему ID, без доступа к аккаунту.", categorySlug: "game-items", priceUzs: 149_000, sellerId: "u-nur", deliveryMethod: "chat", deliveryDays: 1, ago: 5 },
  { id: "l-003", title: "Буст ранга в соревновательном шутере (1 дивизион)", description: "Поднимаем ранг на один дивизион в дуо-режиме: вы играете вместе с тренером, аккаунт остаётся у вас. Расписание согласуем в чате.", categorySlug: "game-services", priceUzs: 220_000, sellerId: "u-bek", deliveryMethod: "manual", deliveryDays: 3, ago: 7, refund: R_SVC },
  { id: "l-004", title: "Разбор вашего матча: видео-анализ от тренера (30 мин)", description: "Присылаете запись матча — получаете структурированный разбор ошибок, позиций и плана тренировок в формате видео и текста.", categorySlug: "game-services", priceUzs: 95_000, sellerId: "u-bek", deliveryMethod: "file", deliveryDays: 2, ago: 12, refund: R_SVC },
  { id: "l-005", title: "Лицензионный ключ офисного пакета на 1 ПК", description: "Ключ активации для одного устройства. Инструкция по активации прилагается. Региональные ограничения указаны в чате перед покупкой.", categorySlug: "keys", priceUzs: 180_000, sellerId: "u-timur", deliveryMethod: "key", deliveryDays: 0, ago: 3, refund: R_KEY },
  { id: "l-006", title: "Ключ активации игры для ПК (глобальный регион)", description: "Цифровой ключ для запуска игры в магазине-лаунчере. Проверяйте требования к системе до покупки. Ключ передаётся автоматически после оплаты.", categorySlug: "keys", priceUzs: 129_000, sellerId: "u-timur", deliveryMethod: "key", deliveryDays: 0, ago: 9, refund: R_KEY },
  { id: "l-007", title: "Ключ антивирусной защиты на 12 месяцев (3 устройства)", description: "Лицензия на 3 устройства, срок — 12 месяцев с момента активации. Подходит для Windows и Android.", categorySlug: "keys", priceUzs: 110_000, sellerId: "u-timur", deliveryMethod: "key", deliveryDays: 0, ago: 14, refund: R_KEY },
  { id: "l-008", title: "Лицензия редактора видео — годовая подписка", description: "Активация годовой лицензии на ваш личный аккаунт. Мы не просим пароль — используется официальная схема приглашения или кода.", categorySlug: "software", priceUzs: 540_000, sellerId: "u-timur", deliveryMethod: "manual", deliveryDays: 1, ago: 18 },
  { id: "l-009", title: "Пакет утилит для школьных презентаций (шаблоны + шрифты)", description: "40 шаблонов презентаций на русском и узбекском, набор свободных шрифтов и иконок. Архив отправляется ссылкой на скачивание.", categorySlug: "software", priceUzs: 35_000, sellerId: "u-malika", deliveryMethod: "file", deliveryDays: 0, ago: 4 },
  { id: "l-010", title: "Семейная подписка на музыкальный сервис — 1 месяц", description: "Приглашение в семейный план по вашему e-mail. Срок — 30 дней. Продление обсуждается отдельно.", categorySlug: "subscriptions", priceUzs: 29_000, sellerId: "u-aziza", deliveryMethod: "manual", deliveryDays: 1, ago: 1 },
  { id: "l-011", title: "Подписка на видеосервис — 3 месяца (приглашение)", description: "Подключаем ваш аккаунт к семейной подписке по официальному приглашению. Пароль не требуется.", categorySlug: "subscriptions", priceUzs: 120_000, sellerId: "u-aziza", deliveryMethod: "manual", deliveryDays: 1, ago: 6 },
  { id: "l-012", title: "Подписка на облачное хранилище 200 ГБ на год", description: "Оформление годового тарифа на ваш аккаунт. Доступна оплата в сумах через демо-режим площадки.", categorySlug: "subscriptions", priceUzs: 210_000, sellerId: "u-aziza", deliveryMethod: "manual", deliveryDays: 2, ago: 21 },
  { id: "l-013", title: "Аккаунт новичка для браузерной игры (продажа разрешена правилами игры)", description: "Продаётся аккаунт, созданный продавцом лично, в игре, где передача аккаунтов не запрещена правилами. Перед покупкой проверьте правила игры. Смена e-mail выполняется вместе с покупателем.", categorySlug: "accounts", priceUzs: 60_000, sellerId: "u-nur", deliveryMethod: "chat", deliveryDays: 1, ago: 16 },
  { id: "l-014", title: "Логотип для бренда: 3 варианта + исходники", description: "Разработка логотипа: 3 концепции, 2 раунда правок, файлы в SVG/PNG и руководство по цветам. Срок — 3 дня.", categorySlug: "design", priceUzs: 350_000, sellerId: "u-dilya", deliveryMethod: "file", deliveryDays: 3, ago: 8, refund: R_SVC },
  { id: "l-015", title: "Оформление Telegram-канала: аватар, обложки, шаблоны постов", description: "Единый визуальный стиль для канала: аватар, 5 шаблонов постов, обложки для рубрик. Форматы PNG и PSD.", categorySlug: "design", priceUzs: 180_000, sellerId: "u-dilya", deliveryMethod: "file", deliveryDays: 2, ago: 11, refund: R_SVC },
  { id: "l-016", title: "Баннеры для интернет-магазина (набор из 5 штук)", description: "Адаптивные баннеры под сайт и соцсети в русской и узбекской версиях. Макеты передаются в PNG и в исходниках.", categorySlug: "design", priceUzs: 240_000, sellerId: "u-dilya", deliveryMethod: "file", deliveryDays: 4, ago: 19, refund: R_SVC },
  { id: "l-017", title: "Telegram-бот под ключ: приём заявок и уведомления", description: "Бот с меню, формой заявки и отправкой уведомлений администратору. Исходный код и инструкция по запуску входят в стоимость.", categorySlug: "design", priceUzs: 650_000, sellerId: "u-jasur", deliveryMethod: "file", deliveryDays: 7, ago: 13, refund: R_SVC },
  { id: "l-018", title: "Лендинг на одну страницу (адаптивный, uz/ru)", description: "Одностраничный сайт: структура, вёрстка, форма обратной связи. Хостинг не включён — передаём готовые файлы и инструкцию.", categorySlug: "design", priceUzs: 780_000, sellerId: "u-jasur", deliveryMethod: "file", deliveryDays: 10, ago: 22, refund: R_SVC },
  { id: "l-019", title: "Видеомонтаж короткого ролика (до 60 секунд)", description: "Монтаж из ваших материалов: нарезка, цветокоррекция, субтитры. Формат 9:16 или 16:9, два раунда правок.", categorySlug: "design", priceUzs: 190_000, sellerId: "u-dilya", deliveryMethod: "file", deliveryDays: 3, ago: 15, refund: R_SVC },
  { id: "l-020", title: "Пресеты для мобильной обработки фото (30 штук)", description: "Набор из 30 пресетов в формате DNG для мобильного редактора, с примерами «до/после» и инструкцией по установке.", categorySlug: "other", priceUzs: 45_000, sellerId: "u-malika", deliveryMethod: "file", deliveryDays: 0, ago: 10 },
  { id: "l-021", title: "Курс «Основы Excel» для начинающих (видео + таблицы)", description: "12 коротких уроков на русском с практическими заданиями и готовыми шаблонами таблиц. Доступ — ссылкой на закрытую страницу.", categorySlug: "other", priceUzs: 79_000, sellerId: "u-malika", deliveryMethod: "file", deliveryDays: 0, ago: 17 },
  { id: "l-022", title: "Шаблон бюджета семьи для таблиц (на сумах)", description: "Готовая таблица учёта доходов и расходов с автоматическими итогами и диаграммами. Подходит для любого табличного редактора.", categorySlug: "other", priceUzs: 25_000, sellerId: "u-malika", deliveryMethod: "file", deliveryDays: 0, ago: 25 },
  { id: "l-023", title: "Донат-пакет «Премиум» для онлайн-игры (код пополнения)", description: "Код пополнения, который активируется в официальном магазине игры. Проверьте регион перед покупкой.", categorySlug: "game-currency", priceUzs: 399_000, sellerId: "u-nur", deliveryMethod: "key", deliveryDays: 0, ago: 20, refund: R_KEY },
  { id: "l-024", title: "Сезонный боевой пропуск — активация по ID", description: "Активация сезонного пропуска по вашему игровому ID, пароль не нужен. Выполняется вручную в течение 1 дня.", categorySlug: "game-items", priceUzs: 165_000, sellerId: "u-nur", deliveryMethod: "manual", deliveryDays: 1, ago: 23 },
];

export const seedListings: Listing[] = raw.map((r, i) => {
  const { ago, refund, fulfil, ...rest } = r;
  return {
    ...rest,
    refundTerms: refund ?? R_STD,
    fulfillmentTerms: fulfil ?? F_STD,
    status: "active",
    isDemo: true,
    views: 120 + ((i * 53) % 900),
    createdAt: iso(ago, i % 7),
  };
});

const buyers = ["Тест-покупатель А.", "Тест-покупатель Б.", "Тест-покупатель В.", "Тест-покупатель Г.", "Тест-покупатель Д."];
const texts: { rating: number; text: string }[] = [
  { rating: 5, text: "Всё выполнено быстро, продавец был на связи. Это тестовый отзыв." },
  { rating: 5, text: "Описание полностью совпало с результатом. Тестовые данные демо-режима." },
  { rating: 4, text: "Хороший результат, небольшая задержка по времени. Тестовый отзыв." },
  { rating: 5, text: "Чётко объяснили, что и как будет выполнено. Пример демонстрационного отзыва." },
  { rating: 4, text: "Всё получил, ответили на вопросы. Тестовые данные." },
  { rating: 3, text: "Нормально, но хотелось быстрее. Это демонстрационный отзыв." },
];

export const seedReviews: Review[] = seedListings.flatMap((l, i) =>
  [0, 1].map((k) => {
    const t = texts[(i + k * 2) % texts.length];
    return {
      id: `r-${l.id}-${k}`,
      listingId: l.id,
      authorId: `demo-buyer-${(i + k) % buyers.length}`,
      authorName: buyers[(i + k) % buyers.length],
      sellerId: l.sellerId,
      rating: t.rating,
      text: t.text,
      createdAt: iso(Math.max(1, 25 - i - k * 3)),
      isDemo: true,
    } satisfies Review;
  }),
);
