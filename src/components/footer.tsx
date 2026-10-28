"use client";

import Link from "next/link";
import { FOUNDER_USERNAME } from "@/lib/data/seed";
import { useDemoState } from "@/lib/store";
import { useT } from "@/lib/i18n";
import { Logo } from "@/components/header";

export function Footer() {
  const t = useT();
  const games = useDemoState().games.filter((g) => g.enabled);
  return (
    <footer className="mt-20 border-t border-line bg-panel/60">
      <div className="container-page grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-3">
          <Logo />
          <p className="max-w-xs text-sm text-muted">
            Игровой маркетплейс с продавцами для Узбекистана. Сейчас работает в демонстрационном режиме.
          </p>
          <p className="text-sm text-muted">
            Основатель и руководитель: <span className="font-semibold text-ink">{FOUNDER_USERNAME}</span>
          </p>
        </div>

        <div>
          <h3 className="mb-3 text-sm font-semibold">Игры</h3>
          <ul className="space-y-2 text-sm text-muted">
            {games.slice(0, 9).map((c) => (
              <li key={c.slug}>
                <Link href={`/catalog?game=${c.slug}`} className="hover:text-ink">
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="mb-3 text-sm font-semibold">Площадка</h3>
          <ul className="space-y-2 text-sm text-muted">
            <li><Link href="/about" className="hover:text-ink">О площадке</Link></li>
            <li><Link href="/support" className="hover:text-ink">Поддержка</Link></li>
            <li><Link href="/support/new" className="hover:text-ink">Открыть обращение</Link></li>
            <li><Link href="/seller/new" className="hover:text-ink">Продать товар</Link></li>
            <li><Link href="/seller" className="hover:text-ink">Кабинет продавца</Link></li>
          </ul>
        </div>

        <div>
          <h3 className="mb-3 text-sm font-semibold">{t("footer.legal")}</h3>
          <ul className="space-y-2 text-sm text-muted">
            <li><Link href="/legal/terms" className="hover:text-ink">Пользовательское соглашение</Link></li>
            <li><Link href="/legal/privacy" className="hover:text-ink">Политика конфиденциальности</Link></li>
            <li><Link href="/legal/rules" className="hover:text-ink">Правила площадки</Link></li>
            <li><Link href="/legal/refunds" className="hover:text-ink">Возвраты и споры</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-line">
        <div className="container-page flex flex-col gap-2 py-5 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 UZMARKET GAMING. Демонстрационная версия: реальные деньги не принимаются и не переводятся.</p>
          <p>Все профили, отзывы и сделки в демо-режиме — тестовые данные.</p>
        </div>
      </div>
    </footer>
  );
}
