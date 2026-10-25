"use client";

import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  ChevronDown,
  FileSearch,
  Lock,
  MessageSquare,
  Plus,
  ScrollText,
  Search,
  ShieldCheck,
  Sparkles,
  Wallet,
  Zap,
} from "lucide-react";
import { useMemo } from "react";
import { ListingCard } from "@/components/listing-card";
import { Avatar, GameIcon, Stars } from "@/components/ui";
import { useT } from "@/lib/i18n";
import { filterListings, DEFAULT_FILTERS } from "@/lib/catalog";
import { useCurrentUser, useDemoState } from "@/lib/store";

const FAQ = [
  {
    q: "Какая комиссия у площадки?",
    a: "Ставка по умолчанию — 5%, для отдельных игр и продавцов она может отличаться. Сумма комиссии и доход продавца показываются до подтверждения заказа и фиксируются в заказе: изменение тарифа не затрагивает старые заказы.",
  },
  {
    q: "Это настоящий маркетплейс? Я могу заплатить реальные деньги?",
    a: "Сейчас UZMARKET работает в демонстрационном режиме: оплата тестовая, реальные деньги не принимаются и не переводятся. Подключение платёжной системы и законной схемы удержания средств будет сделано отдельно, до запуска для публики.",
  },
  {
    q: "Как проходит сделка?",
    a: "Вы создаёте заказ, оплачиваете его (в демо — тестовой оплатой), продавец выполняет и отмечает «Товар передан», вы проверяете результат и подтверждаете получение. Каждый шаг фиксируется в хронологии заказа.",
  },
  {
    q: "Что делать, если товар не соответствует описанию?",
    a: "Откройте спор на странице заказа: опишите проблему и приложите доказательства. Обращение рассмотрит администратор. Площадка не обещает автоматический возврат — решение принимается после проверки.",
  },
  {
    q: "Какие товары запрещено продавать?",
    a: "Нельзя продавать то, что нарушает закон или правила сторонних сервисов, включая аккаунты там, где их передача запрещена. Подробности — в правилах площадки.",
  },
  {
    q: "Как стать продавцом?",
    a: "Зарегистрируйтесь и нажмите «Продать товар»: заполните профиль продавца и примите правила. Затем опубликуйте товар по одной из игр каталога. С каждой завершённой продажи площадка удерживает комиссию — она показана до оформления заказа.",
  },
];

export default function HomePage() {
  const t = useT();
  const s = useDemoState();
  const { user, ready } = useCurrentUser();

  const enabledSlugs = useMemo(() => new Set(s.games.filter((g) => g.enabled).map((g) => g.slug)), [s.games]);
  const active = useMemo(
    () => filterListings(s.listings.filter((l) => enabledSlugs.has(l.gameSlug)), s.profiles, DEFAULT_FILTERS),
    [s.listings, s.profiles, enabledSlugs],
  );
  const popular = useMemo(() => [...active].sort((a, b) => b.views - a.views).slice(0, 6), [active]);
  const recent = useMemo(() => active.slice(0, 6), [active]);
  const visibleGames = s.games.filter((g) => g.enabled).sort((a, b) => a.sortOrder - b.sortOrder);
  const topSellers = useMemo(
    () => s.profiles.filter((p) => p.isSeller && !p.blocked && p.reviewsCount > 0).sort((a, b) => b.rating - a.rating || b.salesCount - a.salesCount).slice(0, 4),
    [s.profiles],
  );

  return (
    <div className="space-y-20">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl border border-line bg-panel px-6 py-12 sm:px-12 sm:py-16">
        <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-accent/25 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -bottom-24 left-1/3 h-72 w-72 rounded-full bg-accent-2/20 blur-3xl" aria-hidden />
        <div className="relative max-w-3xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">
            <Sparkles className="h-3.5 w-3.5" aria-hidden /> Демо-версия · реальные деньги не переводятся
          </span>
          <h1 className="mt-5 font-display text-3xl font-extrabold leading-tight tracking-tight sm:text-5xl">{t("hero.title")}</h1>
          <p className="mt-4 max-w-2xl text-base text-muted sm:text-lg">{t("hero.subtitle")}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/catalog" className="btn-primary !px-6 !py-3">
              <Search className="h-4 w-4" aria-hidden /> {t("hero.cta")}
            </Link>
            <Link href="/seller/new" className="btn-ghost !px-6 !py-3">
              <Plus className="h-4 w-4" aria-hidden /> {t("nav.sell")}
            </Link>
            {ready && !user && (
              <Link href="/register" className="btn-ghost !px-6 !py-3">
                {t("nav.register")}
              </Link>
            )}
          </div>
          <dl className="mt-10 grid max-w-xl grid-cols-3 gap-4 text-sm">
            <div>
              <dt className="text-muted">Объявлений</dt>
              <dd className="font-display text-2xl font-bold">{active.length}</dd>
            </div>
            <div>
              <dt className="text-muted">Игр</dt>
              <dd className="font-display text-2xl font-bold">{visibleGames.length}</dd>
            </div>
            <div>
              <dt className="text-muted">Валюта</dt>
              <dd className="font-display text-2xl font-bold">UZS</dd>
            </div>
          </dl>
        </div>
      </section>

      {/* Игры */}
      <section aria-labelledby="cats">
        <div className="mb-6 flex items-end justify-between gap-4">
          <h2 id="cats" className="font-display text-2xl font-bold">Игры</h2>
          <Link href="/catalog" className="flex items-center gap-1 text-sm font-medium text-accent hover:underline">
            Все товары <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {visibleGames.map((g) => {
            const count = active.filter((l) => l.gameSlug === g.slug).length;
            return (
              <Link key={g.slug} href={`/catalog?game=${g.slug}`} className="card card-hover flex flex-col gap-3 p-4">
                <GameIcon slug={g.slug} className="h-11 w-11 text-xs" />
                <span className="text-sm font-semibold leading-snug">{g.name}</span>
                <span className="text-xs text-muted">{count} предложений</span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Лучшие продавцы */}
      {topSellers.length > 0 && (
        <section aria-labelledby="sellers">
          <h2 id="sellers" className="mb-6 font-display text-2xl font-bold">Лучшие продавцы</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {topSellers.map((p) => (
              <Link key={p.id} href={`/shop?id=${p.id}`} className="card card-hover flex items-center gap-3 p-4">
                <Avatar user={p} className="h-12 w-12" />
                <span className="min-w-0">
                  <span className="flex items-center gap-1 truncate font-semibold">
                    {p.username}
                    {p.verified && <BadgeCheck className="h-4 w-4 shrink-0 text-accent-2" aria-label="Проверенный продавец" />}
                  </span>
                  <span className="flex items-center gap-1.5 text-xs text-muted">
                    <Stars value={p.rating} size="h-3 w-3" /> {p.rating.toFixed(1)} · {p.salesCount} продаж
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Популярные */}
      <section aria-labelledby="popular">
        <h2 id="popular" className="mb-6 font-display text-2xl font-bold">{t("section.popular")}</h2>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {popular.map((l) => (
            <ListingCard key={l.id} listing={l} />
          ))}
        </div>
      </section>

      {/* Недавние */}
      <section aria-labelledby="recent">
        <div className="mb-6 flex items-end justify-between gap-4">
          <h2 id="recent" className="font-display text-2xl font-bold">{t("section.recent")}</h2>
          <Link href="/catalog?sort=new" className="flex items-center gap-1 text-sm font-medium text-accent hover:underline">
            Смотреть все <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {recent.map((l) => (
            <ListingCard key={l.id} listing={l} />
          ))}
        </div>
      </section>

      {/* Преимущества */}
      <section aria-labelledby="adv">
        <h2 id="adv" className="mb-6 font-display text-2xl font-bold">Почему UZMARKET</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Wallet, title: "Прозрачная комиссия", text: "Все суммы в UZS: комиссия и доход продавца видны до оформления заказа." },
            { icon: BadgeCheck, title: "Профили продавцов", text: "Рейтинг, отзывы и количество продаж — вы видите репутацию до покупки." },
            { icon: MessageSquare, title: "Чат по заказу", text: "Вся переписка и информация о выполнении хранятся в карточке заказа." },
            { icon: Zap, title: "Русский и узбекский", text: "Интерфейс на русском, ключевые элементы — на узбекском языке." },
          ].map((a) => (
            <div key={a.title} className="card p-5">
              <a.icon className="h-6 w-6 text-accent" aria-hidden />
              <h3 className="mt-3 font-semibold">{a.title}</h3>
              <p className="mt-1.5 text-sm text-muted">{a.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Как это работает */}
      <section aria-labelledby="how">
        <h2 id="how" className="mb-6 font-display text-2xl font-bold">{t("section.how")}</h2>
        <ol className="grid gap-4 md:grid-cols-4">
          {[
            { n: 1, icon: Search, title: "Найдите товар", text: "Выберите игру, тип товара и воспользуйтесь фильтрами по цене, наличию и рейтингу продавца." },
            { n: 2, icon: ScrollText, title: "Оформите заказ", text: "Проверьте условия выполнения и возврата, создайте заказ с фиксированной ценой." },
            { n: 3, icon: Wallet, title: "Оплатите (тест)", text: "В демо-режиме оплата тестовая. DEMO — реальные деньги не переводятся." },
            { n: 4, icon: ShieldCheck, title: "Получите и подтвердите", text: "Проверьте результат и подтвердите получение — или откройте спор." },
          ].map((step) => (
            <li key={step.n} className="card relative p-5">
              <span className="absolute right-4 top-4 font-display text-4xl font-extrabold text-line">{step.n}</span>
              <step.icon className="h-6 w-6 text-accent-2" aria-hidden />
              <h3 className="mt-3 font-semibold">{step.title}</h3>
              <p className="mt-1.5 text-sm text-muted">{step.text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Безопасность */}
      <section aria-labelledby="safe" className="card overflow-hidden">
        <div className="grid gap-0 lg:grid-cols-2">
          <div className="p-6 sm:p-8">
            <h2 id="safe" className="font-display text-2xl font-bold">Безопасность сделок</h2>
            <p className="mt-3 text-sm text-muted">
              Мы строим площадку вокруг прозрачности: каждый шаг сделки фиксируется, а спорные ситуации рассматриваются людьми.
            </p>
            <ul className="mt-5 space-y-4 text-sm">
              <li className="flex gap-3"><FileSearch className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden /><span><b>Хронология заказа.</b> Статусы и действия сторон записываются и не стираются.</span></li>
              <li className="flex gap-3"><Lock className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden /><span><b>Фиксированная цена.</b> После создания заказа продавец не может изменить сумму.</span></li>
              <li className="flex gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden /><span><b>Споры и поддержка.</b> Обращение с доказательствами рассматривает администратор.</span></li>
            </ul>
          </div>
          <div className="border-t border-line bg-warn/5 p-6 sm:p-8 lg:border-l lg:border-t-0">
            <h3 className="font-semibold text-warn">Честно о демо-режиме</h3>
            <p className="mt-2 text-sm text-muted">
              Сейчас деньги не принимаются, а «оплата» — симуляция. Это <b className="text-ink">не эскроу</b> и не защищённая платёжная система. Законная схема удержания
              средств, договоры и выплаты будут согласованы отдельно до подключения реальных платежей.
            </p>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section aria-labelledby="faq" className="mx-auto w-full max-w-3xl">
        <h2 id="faq" className="mb-6 text-center font-display text-2xl font-bold">{t("section.faq")}</h2>
        <div className="space-y-3">
          {FAQ.map((f) => (
            <details key={f.q} className="card group p-0 [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer items-center justify-between gap-4 px-5 py-4 font-medium">
                {f.q}
                <ChevronDown className="h-4 w-4 shrink-0 text-muted transition group-open:rotate-180" aria-hidden />
              </summary>
              <p className="px-5 pb-5 text-sm text-muted">{f.a}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
