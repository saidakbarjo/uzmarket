# AUDIT.md — UZMARKET GAMING: аудит перед переходом на Supabase

Дата: 2026-10-28 · ветка `feature/supabase-upgrade` (от `main` @ `9d41a83`)

## 1. Архитектура

- Next.js 16 (App Router, Turbopack), React 19, TypeScript, Tailwind v4, Zod 4, lucide-react, vitest, ESLint 9.
- Деплой: GitHub Pages, статический экспорт (`STATIC_EXPORT=1`, `NEXT_PUBLIC_BASE_PATH=/uzmarket`, `trailingSlash`, `images.unoptimized`). Динамические страницы сделаны через `?id=` + Suspense; `legal/[slug]` — `generateStaticParams`. Это **сохраняем**: серверных маршрутов (API routes, middleware) в статике быть не может → привилегированные операции только через Supabase RPC (security definer) и Edge Functions.
- Всё состояние — `src/lib/store.ts`: модуль-синглтон + `useSyncExternalStore`, localStorage `uzmarket.demo.v2`. Действия возвращают `Result<T>`.
- Чистая доменная логика с тестами (не зависит от хранилища, переиспользуется при переходе на Supabase): `commission`, `ledger`, `payouts`, `checkout`, `stats`, `orders-domain`, `catalog`, `validation`, `money`.
- Supabase: пакет `@supabase/supabase-js` установлен, **в коде приложения не используется**. SQL-миграции 0001–0005 написаны и проверены на PGlite (103 + 88 проверок), но не применялись к реальному проекту.

## 2. Что работает, а что — демо

| Область | Состояние |
|---|---|
| Регистрация/вход | ДЕМО: пользователи и «пароли» в localStorage (на одном устройстве) |
| Каталог, поиск, фильтры, сортировка, пагинация | Работает на демо-данных (seed помечен как демо) |
| Избранное, «Вы смотрели» | Работает; гость — localStorage, слияние при входе |
| Объявления (создание/правка/снятие) | ДЕМО; изображения — локально (image-utils) |
| Заказы | ДЕМО: машина статусов, снимок цены, комиссия — логика реальная, хранилище локальное; платежей нет |
| Баланс/выплаты/леджер | ДЕМО-деньги. По новому ТЗ скрывать, пока нет реальной оплаты → флаг |
| Отзывы, рейтинги | Считаются из реальных отзывов/заказов хранилища |
| Админка | ДЕМО; проверки роли в клиенте (в Supabase — через RPC и RLS) |
| Споры, жалобы, поддержка | ДЕМО |
| Telegram, чат до покупки, реальные платежи | Не реализовано (честно указано в README) |

## 3. Проблемы и риски

1. Данные не общие между пользователями/устройствами — настоящий маркетплейс невозможен без бэкенда.
2. Любая проверка роли в браузере обходима → в Supabase роль только из БД (`profiles.role`, колонка без права UPDATE для клиента).
3. Финансовые экраны показывают демо-деньги — противоречит новому ТЗ.
4. Названия статусов заказа отличаются от нового ТЗ (см. таблицу ниже).
5. Нет Storage-бакета и политик для изображений, нет `display_name`/`preferred_language`/`avatar_url` в профиле (закрывает 0006).
6. Статический хостинг: нет серверных маршрутов; Edge Functions нужно деплоить отдельно в проекте Supabase.

## 4. Соответствие ТЗ ↔ существующая схема (без дублей)

| ТЗ | В проекте |
|---|---|
| profiles | `profiles` (+ поля в 0006) |
| user_roles | `profiles.role` (user/seller/admin), без права UPDATE у клиента |
| categories (game_slug) | `games` (игры) + `categories` (типы товаров) |
| listings / listing_images / favorites | есть, + `listings.game_id`, `product_type` |
| orders / order_events | `orders` / `order_events`, снимок цены и комиссии |
| reviews / notifications | есть |
| reports | `support_tickets` (kind=complaint) |
| platform_settings | `site_settings` + `commission_settings` |

Статусы: pending→`pending_payment`; confirmed→`paid` (в тестовом режиме — «подтверждён продавцом», без денег); in_progress→`in_progress`; completed→`completed`; cancelled→`cancelled`; disputed→`disputed`. Дополнительные внутренние: `delivered`, `refund_review`, `refunded`. Переименование не делаем — документируем соответствие.

## 5. План миграции на Supabase

1. Этап 3: миграция `0006` (пробелы схемы + Storage + проверки на PGlite).
2. Этап 4: слой `backend` (демо или Supabase по env), Auth.
3. Этап 5–6: каталог, Storage, кабинет продавца на реальных данных.
4. Этап 7: тестовые заказы через RPC `create_order` (транзакция + резерв остатка + идемпотентность).
5. Этап 8–9: RLS-проверка, Edge Function для админ-операций.
6. Этап 12: проверка сборки Pages (base path, вложенные маршруты, отсутствие секретов).

Нужное от владельца проекта Supabase (без этого интеграцию нельзя проверить): создать проект; выполнить SQL 0001–0006 по порядку; настроить Auth (e-mail, Site URL = `https://saidakbarjo.github.io/uzmarket/`, Redirect URLs); задать публичные `NEXT_PUBLIC_SUPABASE_URL` и `NEXT_PUBLIC_SUPABASE_ANON_KEY`; `service_role` — только в секретах Edge Functions; назначить первого админа вручную.

## 6. Чек-лист регрессии

- [ ] `npm run typecheck`, `npm run lint`, `npm test` (74 теста)
- [ ] `npm run build` и статический экспорт с base path `/uzmarket`
- [ ] Регистрация / вход / выход (демо)
- [ ] Создание/правка/снятие объявления
- [ ] Поиск, фильтры, сортировка, пагинация
- [ ] Избранное гостя и слияние при входе
- [ ] Тестовый заказ, запрет покупки своего товара, смена статусов
- [ ] Отзыв только после завершённого заказа
- [ ] Админка: недоступна обычному пользователю
- [ ] Финансы скрыты при `NEXT_PUBLIC_DEMO_FINANCE` не задан
- [ ] Мобильная вёрстка 375 px без горизонтальной прокрутки
- [ ] Прямое открытие `/listing/?id=…`, `/catalog/` на Pages
- [ ] В бандле нет секретов
- [ ] e2e: `e2e-gaming.js` (55), `e2e-new.js` (23)
