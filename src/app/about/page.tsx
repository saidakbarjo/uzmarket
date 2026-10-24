import type { Metadata } from "next";
import Link from "next/link";
import { Crown, FlaskConical, Globe2, Scale } from "lucide-react";
import { FOUNDER_USERNAME } from "@/lib/data/seed";

export const metadata: Metadata = { title: "О площадке" };

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <header>
        <h1 className="font-display text-3xl font-extrabold sm:text-4xl">О площадке UZMARKET</h1>
        <p className="mt-4 text-lg text-muted">
          UZMARKET — маркетплейс цифровых товаров и услуг для Узбекистана: игровая валюта, ключи, подписки, программы, дизайн и разработка. Цены в сумах, интерфейс на русском и узбекском языках.
        </p>
      </header>

      <section className="card flex flex-col gap-4 p-6 sm:flex-row sm:items-center" aria-labelledby="founder">
        <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-accent to-accent-2 text-white">
          <Crown className="h-8 w-8" aria-hidden />
        </span>
        <div>
          <h2 id="founder" className="text-sm font-semibold uppercase tracking-wide text-muted">Основатель и руководитель</h2>
          <p className="font-display text-2xl font-bold">{FOUNDER_USERNAME}</p>
          <p className="mt-1 text-sm text-muted">Создатель проекта и глава UZMARKET. Отвечает за развитие платформы, правила площадки и взаимодействие с партнёрами.</p>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {[
          { icon: Globe2, title: "Для Узбекистана", text: "Суммы в UZS, русский и узбекский языки, ориентация на локальные платёжные сервисы в будущем." },
          { icon: Scale, title: "Прозрачные правила", text: "Фиксированная цена заказа, хронология событий и разбор споров администратором." },
          { icon: FlaskConical, title: "Демо-этап", text: "Сейчас платформа работает в демонстрационном режиме без реальных денег." },
        ].map((b) => (
          <div key={b.title} className="card p-5">
            <b.icon className="h-6 w-6 text-accent" aria-hidden />
            <h3 className="mt-3 font-semibold">{b.title}</h3>
            <p className="mt-1.5 text-sm text-muted">{b.text}</p>
          </div>
        ))}
      </section>

      <section className="card space-y-3 border-warn/30 p-6" aria-labelledby="demo">
        <h2 id="demo" className="font-semibold text-warn">Статус проекта</h2>
        <p className="text-sm text-muted">
          Это демонстрационная версия. Оплата — симуляция («DEMO — реальные деньги не переводятся»), профили, отзывы и сделки — тестовые данные. Платёжные системы, хостинг, домен и законная схема удержания средств
          будут подключены отдельным этапом после согласования юридической модели.
        </p>
        <Link href="/legal/rules" className="inline-block text-sm font-medium text-accent hover:underline">Читать правила площадки</Link>
      </section>
    </div>
  );
}
