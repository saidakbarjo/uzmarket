import { DEFAULT_COMMISSION, type CommissionSettings } from "@/lib/commission";
import type { Game, Listing, Profile, ProductType, Review, SellerProfile, DeliveryMethod } from "@/lib/types";

export const DEMO_PASSWORD = "demo12345"; // публичный тестовый пароль демо-аккаунтов
export const FOUNDER_USERNAME = "Saidakbar";
export const SITE_NAME = "UZMARKET GAMING";

/** Игры платформы. Администратор может добавлять новые через панель управления. */
export const seedGames: Game[] = [
  { slug: "cs2", name: "CS2", nameUz: "CS2", nameEn: "CS2", abbr: "CS2", hue: 10, enabled: true, sortOrder: 10, description: "Скины и другие разрешённые игровые предметы" },
  { slug: "pubg-mobile", name: "PUBG Mobile", nameUz: "PUBG Mobile", nameEn: "PUBG Mobile", abbr: "PM", hue: 50, enabled: true, sortOrder: 20, description: "Игровые предметы и услуги, разрешённые правилами игры" },
  { slug: "pubg", name: "PUBG: Battlegrounds", nameUz: "PUBG: Battlegrounds", nameEn: "PUBG: Battlegrounds", abbr: "PB", hue: 90, enabled: true, sortOrder: 30, description: "Предметы, коды и услуги для ПК-версии" },
  { slug: "roblox", name: "Roblox", nameUz: "Roblox", nameEn: "Roblox", abbr: "RB", hue: 130, enabled: true, sortOrder: 40, description: "Разрешённые предметы и игровые товары" },
  { slug: "minecraft", name: "Minecraft", nameUz: "Minecraft", nameEn: "Minecraft", abbr: "MC", hue: 170, enabled: true, sortOrder: 50, description: "Внутриигровые товары и услуги" },
  { slug: "fortnite", name: "Fortnite", nameUz: "Fortnite", nameEn: "Fortnite", abbr: "FN", hue: 210, enabled: true, sortOrder: 60, description: "Валюта, наборы и услуги" },
  { slug: "brawl-stars", name: "Brawl Stars", nameUz: "Brawl Stars", nameEn: "Brawl Stars", abbr: "BS", hue: 250, enabled: true, sortOrder: 70, description: "Гемы, пропуск, услуги" },
  { slug: "standoff2", name: "Standoff 2", nameUz: "Standoff 2", nameEn: "Standoff 2", abbr: "S2", hue: 290, enabled: true, sortOrder: 80, description: "Голда, скины и услуги" },
  { slug: "valorant", name: "Valorant", nameUz: "Valorant", nameEn: "Valorant", abbr: "VL", hue: 330, enabled: true, sortOrder: 90, description: "Валюта, коды и услуги тренеров" },
];

/** Начальные настройки комиссии (демо). Процент для CS2 задан отдельно, чтобы показать особые ставки. */
export const seedCommission: CommissionSettings = {
  ...DEFAULT_COMMISSION,
  defaultPercent: 5,
  gamePercent: { cs2: 6 },
  sellerPercent: {},
};

/** «Сейчас» для тестовых данных: даты заказов отсчитываются от этого момента. */
export const SEED_NOW = new Date("2026-10-24T12:00:00Z").getTime();
const day = 86_400_000;
export const seedIso = (daysAgo: number, hours = 0) => new Date(SEED_NOW - daysAgo * day - hours * 3_600_000).toISOString();
const iso = seedIso;

function seller(
  id: string,
  username: string,
  about: string,
  rating: number,
  reviewsCount: number,
  salesCount: number,
  daysAgo: number,
  hue: number,
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
    avatar: `hue:${hue}`,
    ...extra,
  };
}

export const seedProfiles: Profile[] = [
  seller("u-founder", FOUNDER_USERNAME, "Основатель и руководитель UZMARKET GAMING. Тестовый профиль администратора для демо-режима.", 5, 0, 0, 120, 265, {
    role: "admin",
    isSeller: false,
    verified: true,
    email: "saidakbar@uzmarket.demo",
  }),
  seller("u-nur", "NurGameShop", "Игровая валюта и наборы для мобильных игр. Тестовый профиль.", 4.9, 148, 412, 300, 50),
  seller("u-timur", "TimurSkins", "Скины и предметы для CS2 и Standoff 2. Тестовый профиль.", 4.6, 92, 267, 260, 10),
  seller("u-aziza", "AzizaPlay", "Roblox и Minecraft: коды и наборы. Тестовый профиль.", 4.7, 71, 190, 180, 130),
  seller("u-bek", "BekCoach", "Тренер по соревновательным играм: разборы и обучение. Тестовый профиль.", 4.5, 38, 77, 150, 330),
  seller("u-jasur", "JasurFN", "Fortnite и Valorant: валюта и коды пополнения. Тестовый профиль.", 4.9, 53, 98, 240, 210),
  seller("u-malika", "MalikaCraft", "Minecraft: наборы и услуги по сборкам. Тестовый профиль.", 4.4, 29, 61, 120, 170),
  seller("u-dilya", "DilyaBrawl", "Brawl Stars: гемы и пропуск, помощь с прокачкой. Тестовый профиль.", 4.8, 64, 133, 210, 250),
];

export const seedSellerProfiles: SellerProfile[] = seedProfiles
  .filter((p) => p.isSeller)
  .map((p) => ({
    userId: p.id,
    shopName: p.username,
    about: p.about,
    payoutMethod: "card_demo",
    createdAt: p.createdAt,
    acceptedRulesAt: p.createdAt,
  }));

type L = {
  id: string;
  game: string;
  type: ProductType;
  seller: string;
  title: string;
  description: string;
  price: number;
  stock: number | null;
  delivery?: DeliveryMethod;
  days?: number;
  ago: number;
  available?: boolean;
  refund?: string;
};

const R_STD = "Возврат возможен до начала выполнения. После передачи товара — только через спор, если товар не соответствует описанию.";
const R_KEY = "Код не подошёл или уже использован — откройте спор в течение 24 часов после получения.";
const R_SVC = "Если услуга не выполнена в срок или выполнена не по описанию — откройте спор. Частичный возврат по согласованию.";
const F_STD = "Продавец передаёт товар через чат заказа и отмечает заказ как «Товар передан». Покупатель подтверждает получение. Пароли от аккаунтов не запрашиваются.";

const raw: L[] = [
  { id: "l-001", game: "pubg-mobile", type: "currency", seller: "u-nur", title: "PUBG Mobile: 660 UC — пополнение по игровому ID", description: "Пополнение баланса UC по вашему игровому ID, пароль не нужен. Выполняется вручную продавцом, обычно за 10–15 минут. Подходит для серверов Европа и Азия.", price: 289_000, stock: 40, delivery: "manual", days: 0, ago: 2 },
  { id: "l-002", game: "pubg-mobile", type: "item", seller: "u-nur", title: "PUBG Mobile: набор «Стартовый боец» (одежда + расходники)", description: "Набор для старта: комплект одежды и расходники. Передача через официальный магазин по вашему ID, без доступа к аккаунту.", price: 149_000, stock: 12, delivery: "chat", days: 1, ago: 5 },
  { id: "l-003", game: "pubg-mobile", type: "service", seller: "u-bek", title: "PUBG Mobile: тренировка в дуо — 2 часа с тренером", description: "Играем вместе в дуо: разбор позиций, работа с отдачей, командные сигналы. Аккаунт остаётся у вас, расписание согласуем в чате.", price: 220_000, stock: null, delivery: "manual", days: 3, ago: 7, refund: R_SVC },
  { id: "l-004", game: "valorant", type: "service", seller: "u-bek", title: "Valorant: разбор вашего матча — видео-анализ (30 мин)", description: "Присылаете запись матча — получаете структурированный разбор ошибок, позиций и план тренировок в формате видео и текста.", price: 95_000, stock: null, delivery: "file", days: 2, ago: 12, refund: R_SVC },
  { id: "l-005", game: "cs2", type: "item", seller: "u-timur", title: "CS2: перчатки Hydra — Field-Tested (тестовое предложение)", description: "Тестовая позиция для демонстрации: скин передаётся через официальный обмен Steam, перед сделкой отправляется скриншот предмета с float.", price: 1_850_000, stock: 1, delivery: "chat", days: 1, ago: 3 },
  { id: "l-006", game: "cs2", type: "item", seller: "u-timur", title: "CS2: набор наклеек «Турнир» — 5 штук", description: "Пять наклеек из турнирной серии, передача через обмен Steam. Состав набора указан в описании и фиксируется на скриншоте перед сделкой.", price: 120_000, stock: 8, delivery: "chat", days: 1, ago: 9 },
  { id: "l-007", game: "cs2", type: "key", seller: "u-timur", title: "CS2: подарочный код пополнения кошелька Steam на 50 000 сум", description: "Код пополнения для региона Узбекистан. Проверьте условия региона перед покупкой. Код выдаётся в чате заказа после оплаты.", price: 52_000, stock: 25, delivery: "key", days: 0, ago: 14, refund: R_KEY },
  { id: "l-008", game: "cs2", type: "service", seller: "u-bek", title: "CS2: обучение прицеливанию и спрею — урок 60 минут", description: "Индивидуальный урок: разбор вашей стрельбы, упражнения для разминки, настройка чувствительности. Без вмешательства в игру и читов.", price: 85_000, stock: null, delivery: "manual", days: 2, ago: 18, refund: R_SVC },
  { id: "l-009", game: "pubg", type: "key", seller: "u-jasur", title: "PUBG: Battlegrounds — код пополнения G-Coin (1 200 G-Coin)", description: "Код пополнения для ПК-версии. Активируется в официальном магазине игры. Код передаётся в чате заказа, пароль не нужен.", price: 245_000, stock: 15, delivery: "key", days: 0, ago: 4, refund: R_KEY },
  { id: "l-010", game: "pubg", type: "service", seller: "u-bek", title: "PUBG: Battlegrounds — разбор вашей игры и план роста", description: "Пришлите записи двух матчей — получите письменный разбор: выбор мест высадки, ротации, работа с лутом и план тренировок.", price: 110_000, stock: null, delivery: "file", days: 2, ago: 11, refund: R_SVC },
  { id: "l-011", game: "pubg", type: "other", seller: "u-timur", title: "PUBG: Battlegrounds — набор кастомных настроек клавиш и чувствительности", description: "Готовый файл настроек и инструкция по установке. Ничего не меняет в игре, только пользовательские настройки управления.", price: 30_000, stock: null, delivery: "file", days: 0, ago: 20 },
  { id: "l-012", game: "roblox", type: "key", seller: "u-aziza", title: "Roblox: подарочная карта на 800 Robux (код)", description: "Цифровая подарочная карта, активируется в вашем аккаунте на официальном сайте. Код выдаётся в чате после оплаты.", price: 135_000, stock: 30, delivery: "key", days: 0, ago: 1, refund: R_KEY },
  { id: "l-013", game: "roblox", type: "currency", seller: "u-aziza", title: "Roblox: 2 000 Robux через официальный способ пополнения", description: "Пополнение по инструкции с использованием подарочных карт. Пароль не запрашивается, процесс описан пошагово.", price: 330_000, stock: 10, delivery: "chat", days: 1, ago: 6 },
  { id: "l-014", game: "roblox", type: "service", seller: "u-aziza", title: "Roblox: помощь с настройкой своей игры (скрипты Lua, 1 час)", description: "Консультация по скриптам для вашей собственной игры в Roblox Studio: структура, события, отладка. Исходники остаются у вас.", price: 90_000, stock: null, delivery: "manual", days: 2, ago: 16, refund: R_SVC },
  { id: "l-015", game: "minecraft", type: "key", seller: "u-malika", title: "Minecraft: подарочная карта магазина (код) — 10 USD", description: "Цифровой код для покупки контента в официальном магазине. Код передаётся в чате заказа, проверяйте регион перед покупкой.", price: 128_000, stock: 20, delivery: "key", days: 0, ago: 3, refund: R_KEY },
  { id: "l-016", game: "minecraft", type: "item", seller: "u-malika", title: "Minecraft: набор карт и текстур для творческого режима", description: "Архив с 5 картами и 3 наборами текстур. Установка по инструкции из файла. Все материалы собственные, без нарушения авторских прав.", price: 45_000, stock: null, delivery: "file", days: 0, ago: 13 },
  { id: "l-017", game: "minecraft", type: "service", seller: "u-malika", title: "Minecraft: настройка выделенного сервера для друзей", description: "Поднимем сервер на вашем арендованном хостинге: версия, белый список, базовые плагины. Доступ вы выдаёте временно, потом отзываете.", price: 160_000, stock: null, delivery: "manual", days: 2, ago: 21, refund: R_SVC },
  { id: "l-018", game: "fortnite", type: "currency", seller: "u-jasur", title: "Fortnite: 1 000 V-Bucks — подарочный код", description: "Код пополнения V-Bucks для вашей платформы (уточните в чате). Активация в официальном магазине, пароль не запрашивается.", price: 98_000, stock: 18, delivery: "key", days: 0, ago: 2, refund: R_KEY },
  { id: "l-019", game: "fortnite", type: "key", seller: "u-jasur", title: "Fortnite: код боевого пропуска сезона", description: "Код активации сезонного пропуска на официальном сайте. Передаётся в чате, срок действия указан в описании кода.", price: 89_000, stock: 9, delivery: "key", days: 0, ago: 8, refund: R_KEY },
  { id: "l-020", game: "fortnite", type: "service", seller: "u-bek", title: "Fortnite: тренировка строительства и редактирования — 90 минут", description: "Тренировка в творческом режиме: построение, быстрые редактирования, упражнения для разминки. Без передачи аккаунта.", price: 120_000, stock: null, delivery: "manual", days: 3, ago: 19, refund: R_SVC },
  { id: "l-021", game: "brawl-stars", type: "currency", seller: "u-dilya", title: "Brawl Stars: 170 гемов — пополнение по ID", description: "Пополнение гемов по вашему игровому ID без пароля. Выполняется вручную продавцом в течение 15–30 минут.", price: 180_000, stock: 25, delivery: "manual", days: 0, ago: 1 },
  { id: "l-022", game: "brawl-stars", type: "key", seller: "u-dilya", title: "Brawl Stars: Brawl Pass — активация по инструкции", description: "Активация сезонного пропуска через официальный магазин на вашем устройстве по пошаговой инструкции. Пароль не нужен.", price: 99_000, stock: 14, delivery: "chat", days: 0, ago: 5 },
  { id: "l-023", game: "brawl-stars", type: "service", seller: "u-dilya", title: "Brawl Stars: помощь с прокачкой бойцов — план на неделю", description: "Составим план развития бойцов под ваш стиль и дадим рекомендации по режимам. Играете вы сами, мы лишь консультируем.", price: 70_000, stock: null, delivery: "manual", days: 7, ago: 15, refund: R_SVC },
  { id: "l-024", game: "standoff2", type: "currency", seller: "u-timur", title: "Standoff 2: 1 000 голды — пополнение по ID", description: "Пополнение голды через официальный способ по вашему ID. Пароль не запрашивается, выдача вручную в течение часа.", price: 175_000, stock: 30, delivery: "manual", days: 0, ago: 2 },
  { id: "l-025", game: "standoff2", type: "item", seller: "u-timur", title: "Standoff 2: набор оформления «Городской» (скины, тестовое)", description: "Тестовое предложение набора косметики. Передача через внутриигровой обмен, перед сделкой присылаем скриншот инвентаря.", price: 140_000, stock: 5, delivery: "chat", days: 1, ago: 10 },
  { id: "l-026", game: "standoff2", type: "service", seller: "u-bek", title: "Standoff 2: тренировка по тактикам — 1 час", description: "Разбираем карты, позиции и работу в команде в совместной игре. Аккаунт остаётся у вас, времена сессий согласуем в чате.", price: 65_000, stock: null, delivery: "manual", days: 2, ago: 17, refund: R_SVC },
  { id: "l-027", game: "valorant", type: "currency", seller: "u-jasur", title: "Valorant: 1 000 VP — код пополнения", description: "Код пополнения Valorant Points для вашего региона. Активация в официальном клиенте, пароль не требуется.", price: 118_000, stock: 22, delivery: "key", days: 0, ago: 3, refund: R_KEY },
  { id: "l-028", game: "valorant", type: "key", seller: "u-jasur", title: "Valorant: подарочная карта 25 USD (код)", description: "Цифровая подарочная карта для магазина Riot, код передаётся в чате заказа. Проверьте региональные ограничения до покупки.", price: 310_000, stock: 7, delivery: "key", days: 0, ago: 9, refund: R_KEY },
  { id: "l-029", game: "valorant", type: "service", seller: "u-bek", title: "Valorant: индивидуальный урок по игре за контролёров — 60 минут", description: "Урок: использование умений, раскидки, выбор позиций. Проводим разбор ваших записей и тренируемся в кастомной игре.", price: 100_000, stock: null, delivery: "manual", days: 3, ago: 22, refund: R_SVC },
  { id: "l-030", game: "valorant", type: "other", seller: "u-timur", title: "Valorant: готовые настройки прицела и графики (файл + инструкция)", description: "Набор из 10 проверенных вариантов прицела и рекомендации по настройкам графики. Файлы только пользовательских настроек.", price: 25_000, stock: null, delivery: "file", days: 0, ago: 24, available: false },
];

export const seedListings: Listing[] = raw.map((r, i) => ({
  id: r.id,
  title: r.title,
  description: r.description,
  gameSlug: r.game,
  productType: r.type,
  priceUzs: r.price,
  stock: r.stock,
  available: r.available ?? true,
  sellerId: r.seller,
  status: "active",
  deliveryMethod: r.delivery ?? "chat",
  deliveryDays: r.days ?? 1,
  refundTerms: r.refund ?? R_STD,
  fulfillmentTerms: F_STD,
  images: [],
  createdAt: iso(r.ago, i % 7),
  isDemo: true,
  views: 120 + ((i * 53) % 900),
}));

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
      ...(i % 5 === 0 && k === 0 ? { sellerReply: { text: "Спасибо за отзыв! (тестовый ответ продавца)", at: iso(Math.max(1, 24 - i)) } } : {}),
    } satisfies Review;
  }),
);
