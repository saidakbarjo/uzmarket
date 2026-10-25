"use client";

import Link from "next/link";
import { Store } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Field, Notice, PageHeader, Spinner } from "@/components/ui";
import { PAYOUT_METHOD_LABELS } from "@/lib/payouts";
import { becomeSeller, useDemoState } from "@/lib/store";
import { toast } from "@/lib/toast";
import type { PayoutMethod } from "@/lib/types";
import type { FieldErrors } from "@/lib/validation";

/** Форма профиля продавца: после отправки пользователь получает доступ к кабинету продавца. */
export function BecomeSeller() {
  const s = useDemoState();
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [form, setForm] = useState({ shopName: "", about: "", payoutMethod: "card_demo" as PayoutMethod, acceptRules: false });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const r = becomeSeller(form);
    setBusy(false);
    if (!r.ok) {
      setErrors(r.fieldErrors ?? {});
      toast.error(r.fieldErrors ? "Проверьте поля формы" : r.error);
      return;
    }
    toast.success("Профиль продавца создан. Можно публиковать товары!");
  }

  const c = s.commission;
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Стать продавцом" subtitle="Заполните профиль продавца — после этого откроются кабинет и публикация товаров." />
      <form onSubmit={onSubmit} className="card space-y-5 p-5 sm:p-6" noValidate>
        <Field label="Название магазина / ник продавца" htmlFor="shop" error={errors.shopName}>
          <input id="shop" className="input" value={form.shopName} onChange={(e) => setForm({ ...form, shopName: e.target.value })} maxLength={40} />
        </Field>
        <Field label="О себе и своих товарах" htmlFor="about" error={errors.about} hint={`${form.about.length}/500`}>
          <textarea id="about" rows={4} className="input" value={form.about} onChange={(e) => setForm({ ...form, about: e.target.value })} maxLength={500} />
        </Field>
        <Field label="Предпочтительный способ вывода (тест)" htmlFor="pm" error={errors.payoutMethod}>
          <select id="pm" className="input" value={form.payoutMethod} onChange={(e) => setForm({ ...form, payoutMethod: e.target.value as PayoutMethod })}>
            {(Object.keys(PAYOUT_METHOD_LABELS) as PayoutMethod[]).map((m) => (
              <option key={m} value={m}>{PAYOUT_METHOD_LABELS[m]}</option>
            ))}
          </select>
        </Field>
        <Notice>
          Комиссия площадки: <b>{c.defaultPercent}%</b> с завершённой продажи (для отдельных игр и продавцов может отличаться — точная сумма видна до
          оформления заказа). Сейчас всё работает в <b>тестовом режиме</b>: реальные деньги не принимаются и не выплачиваются.
        </Notice>
        <div>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1 h-4 w-4 accent-[var(--color-accent)]" checked={form.acceptRules} onChange={(e) => setForm({ ...form, acceptRules: e.target.checked })} />
            <span>
              Я принимаю <Link href="/legal/rules" className="text-accent hover:underline">правила площадки</Link> и обязуюсь продавать только то, что разрешено законом и правилами игры.
            </span>
          </label>
          {errors.acceptRules && <p role="alert" className="mt-1 text-xs font-medium text-danger">{errors.acceptRules}</p>}
        </div>
        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? <Spinner /> : <Store className="h-4 w-4" aria-hidden />} Стать продавцом
        </button>
      </form>
    </div>
  );
}
