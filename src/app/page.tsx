"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, BadgeCheck, ChevronDown, Search } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { ListingCard } from "@/components/listing-card";
import { Avatar, Stars, coverStyle } from "@/components/ui";
import { useT } from "@/lib/i18n";
import { formatUZS } from "@/lib/money";
import { filterListings, DEFAULT_FILTERS, isInStock } from "@/lib/catalog";
import { useRecentlyViewed } from "@/lib/guest";
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

const QUICK = ["UC", "V-Bucks", "Robux", "голда", "гемы", "тренировка"];

const STEPS = [
  { title: "Найдите товар", text: "Выберите игру и тип товара, отфильтруйте по цене и рейтингу продавца." },
  { title: "Проверьте сумму", text: "До оплаты видны цена, комиссия площадки и итог. Они фиксируются в заказе." },
  { title: "Оплатите (тест)", text: "В демо оплата имитируется, реальные деньги не переводятся." },
  { title: "Подтвердите получение", text: "Всё в порядке — подтвердите заказ. Нет — откройте спор." },
];

export default function HomePage() {
  const t = useT();
  const router = useRouter();
  const s = useDemoState();
  const { user, ready } = useCurrentUser();
  const [q, setQ] = useState("");
  const recentIds = useRecentlyViewed();

  const enabledSlugs = useMemo(() => new Set(s.games.filter((g) => g.enabled).map((g) => g.slug)), [s.games]);
  const active = useMemo(
    () => filterListings(s.listings.filter((l) => enabledSlugs.has(l.gameSlug)), s.profiles, DEFAULT_FILTERS),
    [s.listings, s.profiles, enabledSlugs],
  );
  const popular = useMemo(() => [...active].sort((a, b) => b.views - a.views).slice(0, 8), [active]);
  const recent = useMemo(() => active.slice(0, 4), [active]);
  const visibleGames = useMemo(() => s.games.filter((g) => g.enabled).sort((a, b) => a.sortOrder - b.sortOrder), [s.games]);
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of active) m.set(l.gameSlug, (m.get(l.gameSlug) ?? 0) + 1);
    return m;
  }, [active]);
  const featured = useMemo(() => [...visibleGames].sort((a, b) => (counts.get(b.slug) ?? 0) - (counts.get(a.slug) ?? 0))[0]?.slug, [visibleGames, counts]);
  /** Лучшая цена по играм: самое дешёвое доступное предложение в каждой игре (без выдуманных скидок). */
  const bestPrices = useMemo(() => {
    const best = new Map<string, (typeof active)[number]>();
    for (const l of active) {
      if (!isInStock(l)) continue;
      const cur = best.get(l.gameSlug);
      if (!cur || l.priceUzs < cur.priceUzs) best.set(l.gameSlug, l);
    }
    return [...best.values()].sort((a, b) => a.priceUzs - b.priceUzs).slice(0, 4);
  }, [active]);
  const viewed = useMemo(() => recentIds.map((id) => active.find((l) => l.id === id)).filter((l): l is (typeof active)[number] => !!l).slice(0, 4), [recentIds, active]);
  const mosaic = useMemo(() => [...visibleGames].sort((a, b) => Number(b.slug === featured) - Number(a.slug === featured)), [visibleGames, featured]);
  const topSellers = useMemo(
    () => s.profiles.filter((p) => p.isSeller && !p.blocked && p.reviewsCount > 0).sort((a, b) => b.rating - a.rating || b.salesCount - a.salesCount).slice(0, 4),
    [s.profiles],
  );

  function onSearch(e: FormEvent) {
    e.preventDefault();
    router.push(q.trim() ? `/catalog?q=${encodeURIComponent(q.trim())}` : "/catalog");
  }

  return (
    <div className="space-y-16 sm:space-y-20">
      {/* Hero: поиск и мозаика игр */}
      <section aria-labelledby="hero" className="relative -mt-2">
        <div className="ornament pointer-events-none absolute inset-x-0 -top-10 h-72 opacity-[0.05] [mask-image:linear-gradient(to_bottom,black,transparent)]" aria-hidden />
        <div className="relative max-w-3xl">
          <h1 id="hero" className="text-[1.9rem] font-semibold leading-[1.12] sm:text-5xl">{t("hero.title")}</h1>
          <p className="mt-4 max-w-xl text-base text-muted sm:text-lg">{t("hero.subtitle")}</p>
          <form onSubmit={onSearch} role="search" className="mt-7 flex max-w-2xl gap-2">
            <label htmlFor="hero-q" className="sr-only">Поиск товаров</label>
            <input
              id="hero-q"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Например: 660 UC, скины Valorant, V-Bucks"
              className="input !rounded-xl !py-3.5 !text-base"
              autoComplete="off"
            />
            <button type="submit" className="btn-primary shrink-0 !px-5 !py-3.5">
              <Search className="h-4 w-4" aria-hidden /> <span className="hidden sm:inline">Найти</span><span className="sr-only sm:hidden">Найти</span>
            </button>
          </form>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted">Часто ищут:</span>
            {QUICK.map((w) => (
              <Link key={w} href={`/catalog?q=${encodeURIComponent(w)}`} className="rounded-full border border-line px-3 py-1 text-ink/90 transition hover:border-accent hover:text-accent">
                {w}
              </Link>
            ))}
          </div>
        </div>

        <ul className="relative mt-9 grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-6" aria-label="Игры">
          {mosaic.map((g, i) => {
            const big = g.slug === featured && visibleGames.length >= 5;
            return (
              <li
                key={g.slug}
                className={big ? "col-span-2 row-span-2" : ""}
                style={{ animation: "tile-in 0.5s cubic-bezier(0.2, 0.7, 0.2, 1) both", animationDelay: `${i * 55}ms` }}
              >
                <Link
                  href={`/catalog?game=${g.slug}`}
                  className={`group relative isolate flex h-full flex-col justify-end overflow-hidden rounded-xl border border-white/10 p-3.5 transition hover:border-accent/70 ${big ? "min-h-[8rem] sm:min-h-[14rem] sm:p-5" : "min-h-[6.5rem] sm:min-h-[6.75rem]"}`}
                  style={coverStyle(g.hue)}
                >
                  <span className="ornament absolute inset-0 opacity-[0.08] transition group-hover:opacity-[0.16]" aria-hidden />
                  <span aria-hidden className={`absolute -right-1 -top-2 font-display font-black leading-none tracking-tighter text-white/[0.16] ${big ? "text-[7rem] sm:text-[9rem]" : "text-[3.4rem]"}`}>{g.abbr}</span>
                  <span className="relative">
                    <span className={`block font-display font-semibold leading-tight text-white ${big ? "text-lg sm:text-2xl" : "text-[13px] sm:text-sm"}`}>{g.name}</span>
                    <span className="mt-0.5 block text-xs text-white/70">{counts.get(g.slug) ?? 0} предложений</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
        <div className="mt-5 flex flex-wrap items-center gap-3 text-sm">
          <Link href="/seller/new" className="btn-ghost">Продать товар</Link>
          {ready && !user && <Link href="/register" className="text-accent hover:underline">Создать аккаунт</Link>}
          <span className="text-muted">Демо-версия: реальные деньги не переводятся.</span>
        </div>
      </section>

      {/* Популярное */}
      <section aria-labelledby="popular">
        <div className="mb-5 flex items-end justify-between gap-4">
          <h2 id="popular" className="text-xl font-semibold sm:text-2xl">{t("section.popular")}</h2>
          <Link href="/catalog" className="flex shrink-0 items-center gap-1 whitespace-nowrap text-sm font-medium text-accent hover:underline">
            Весь каталог <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {popular.map((l) => (
            <ListingCard key={l.id} listing={l} />
          ))}
        </div>
      </section>

      {/* Продавцы */}
      {topSellers.length > 0 && (
        <section aria-labelledby="sellers">
          <h2 id="sellers" className="mb-5 text-xl font-semibold sm:text-2xl">Лучшие продавцы</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {topSellers.map((p) => (
              <Link key={p.id} href={`/shop?id=${p.id}`} className="flex items-center gap-3 rounded-xl border border-line bg-panel p-4 transition hover:border-accent/60">
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

      {/* Новое */}
      <section aria-labelledby="recent">
        <div className="mb-5 flex items-end justify-between gap-4">
          <h2 id="recent" className="text-xl font-semibold sm:text-2xl">{t("section.recent")}</h2>
          <Link href="/catalog?sort=new" className="flex shrink-0 items-center gap-1 whitespace-nowrap text-sm font-medium text-accent hover:underline">
            Смотреть все <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {recent.map((l) => (
            <ListingCard key={l.id} listing={l} />
          ))}
        </div>
      </section>

      {/* Лучшая цена */}
      {bestPrices.length > 0 && (
        <section aria-labelledby="best">
          <h2 id="best" className="text-xl font-semibold sm:text-2xl">Лучшие предложения</h2>
          <p className="mb-5 mt-1 text-sm text-muted">Самая низкая цена в каждой игре среди товаров в наличии.</p>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {bestPrices.map((l) => (
              <ListingCard key={l.id} listing={l} />
            ))}
          </div>
        </section>
      )}

      {/* Недавно просмотренные (хранятся только в этом браузере) */}
      {viewed.length > 0 && (
        <section aria-labelledby="viewed">
          <h2 id="viewed" className="mb-5 text-xl font-semibold sm:text-2xl">Вы смотрели</h2>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {viewed.map((l) => (
              <ListingCard key={l.id} listing={l} />
            ))}
          </div>
        </section>
      )}

      {/* Безопасная торговля */}
      <section aria-labelledby="safe">
        <h2 id="safe" className="mb-5 text-xl font-semibold sm:text-2xl">Правила безопасной торговли</h2>
        <ul className="grid gap-x-8 gap-y-4 text-sm sm:grid-cols-2">
          <li><b>Не передавайте пароли.</b> Площадка и продавцы не просят пароль от вашего игрового аккаунта и коды из писем.</li>
          <li><b>Общайтесь в чате заказа.</b> Переписка и этапы сделки сохраняются — это поможет при споре.</li>
          <li><b>Проверьте результат до подтверждения.</b> Подтверждайте получение только когда убедились, что товар соответствует описанию.</li>
          <li><b>Аккаунты — на ваш риск.</b> Передача аккаунтов может нарушать правила игры и привести к блокировке; восстановить доступ не всегда возможно.</li>
        </ul>
      </section>

      {/* Как это работает: шаги идут по порядку */}
      <section aria-labelledby="how">
        <h2 id="how" className="mb-6 text-xl font-semibold sm:text-2xl">{t("section.how")}</h2>
        <ol className="grid gap-x-6 gap-y-7 md:grid-cols-4">
          {STEPS.map((step, i) => (
            <li key={step.title} className="relative border-t-2 border-accent/70 pt-4">
              <span className="font-display text-sm font-semibold text-accent">{i + 1}</span>
              <h3 className="mt-1 font-semibold">{step.title}</h3>
              <p className="mt-1.5 text-sm text-muted">{step.text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Комиссия и честность демо */}
      <section aria-labelledby="fee" className="grid gap-px overflow-hidden rounded-xl border border-line bg-line lg:grid-cols-2">
        <div className="bg-panel p-6 sm:p-8">
          <h2 id="fee" className="text-xl font-semibold sm:text-2xl">Комиссия видна заранее</h2>
          <p className="mt-3 text-sm text-muted">Пример при ставке 5%: товар за {formatUZS(100000)}.</p>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between gap-3 border-b border-line pb-2"><dt className="text-muted">Цена товара</dt><dd className="font-semibold">{formatUZS(100000)}</dd></div>
            <div className="flex justify-between gap-3 border-b border-line pb-2"><dt className="text-muted">Комиссия площадки</dt><dd className="font-semibold">{formatUZS(5000)}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted">Продавец получит</dt><dd className="font-semibold text-gold">{formatUZS(95000)}</dd></div>
          </dl>
          <p className="mt-4 text-sm text-muted">Ставка и сумма записываются в заказ. Если тариф изменится, старые заказы останутся прежними.</p>
        </div>
        <div className="bg-panel-2 p-6 sm:p-8">
          <h3 className="text-lg font-semibold text-warn">Это демо-версия</h3>
          <p className="mt-3 text-sm text-muted">
            Оплата здесь имитируется: деньги не принимаются и не переводятся. Это <b className="text-ink">не эскроу</b> и не платёжная система.
            Реальные платежи и законная схема удержания средств будут подключены отдельно, до запуска для публики.
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section aria-labelledby="faq" className="mx-auto w-full max-w-3xl">
        <h2 id="faq" className="mb-6 text-xl font-semibold sm:text-2xl">{t("section.faq")}</h2>
        <div className="space-y-2.5">
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
