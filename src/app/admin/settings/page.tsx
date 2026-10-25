"use client";

import { RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { ConfirmButton, Notice, PageHeader } from "@/components/ui";
import { FOUNDER_USERNAME } from "@/lib/data/seed";
import { resetDemoData, setModerationEnabled, useDemoState } from "@/lib/store";
import { toast } from "@/lib/toast";

export default function AdminSettingsPage() {
  const router = useRouter();
  const s = useDemoState();
  return (
    <div className="space-y-6">
      <PageHeader title="Настройки площадки" subtitle="Основные параметры площадки. Комиссии настраиваются в отдельном разделе." />

      <section className="card p-5 sm:p-6">
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div><dt className="text-muted">Основатель и руководитель</dt><dd className="font-semibold">{FOUNDER_USERNAME}</dd></div>
          <div><dt className="text-muted">Валюта</dt><dd className="font-semibold">UZS (целые сумы)</dd></div>
          <div><dt className="text-muted">Комиссия (демо)</dt><dd className="font-semibold">{s.commission.defaultPercent}% по умолчанию (раздел «Комиссии»)</dd></div>
          <div><dt className="text-muted">Платёжный провайдер</dt><dd className="font-semibold">DemoPaymentProvider (реальные деньги не используются)</dd></div>
          <div><dt className="text-muted">Хранилище данных</dt><dd className="font-semibold">localStorage браузера (демо)</dd></div>
          <div><dt className="text-muted">Авторизация</dt><dd className="font-semibold">Демонстрационная; будущая — Supabase Auth</dd></div>
        </dl>
      </section>

      <section className="card space-y-2 p-5 sm:p-6">
        <h2 className="font-semibold">Модерация объявлений</h2>
        <p className="text-sm text-muted">Если включена, новые и изменённые объявления продавцов появляются в каталоге только после одобрения администратором.</p>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" className="h-4 w-4 accent-[var(--color-accent)]" checked={s.settings.moderationEnabled} onChange={(e) => { const r = setModerationEnabled(e.target.checked); if (r.ok) toast.success(e.target.checked ? "Модерация включена" : "Модерация выключена"); else toast.error(r.error); }} />
          Предварительная модерация включена
        </label>
      </section>

      <Notice>До подключения реальных платежей нужно отдельно согласовать законную модель удержания средств, договоры и порядок выплат. Демо-режим не является эскроу.</Notice>

      <section className="card space-y-3 p-5 sm:p-6">
        <h2 className="font-semibold">Опасная зона</h2>
        <p className="text-sm text-muted">Вернуть исходные тестовые данные и удалить всё, что было создано в этом браузере.</p>
        <ConfirmButton
          label="Сбросить демо-данные"
          icon={<RotateCcw className="h-4 w-4" aria-hidden />}
          title="Сбросить все демо-данные?"
          description="Все созданные в этом браузере аккаунты, объявления, заказы и обращения будут удалены. Действие нельзя отменить."
          confirmLabel="Да, сбросить"
          onConfirm={() => {
            resetDemoData();
            toast.success("Демо-данные сброшены");
            router.push("/");
          }}
        />
      </section>
    </div>
  );
}
