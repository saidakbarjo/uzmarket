"use client";

import { useRouter } from "next/navigation";
import { ImagePlus } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Field, ListingImage, Notice, Spinner } from "@/components/ui";
import { categories } from "@/lib/data/seed";
import { formatUZS } from "@/lib/money";
import { createListing, updateListing, useDemoState } from "@/lib/store";
import { toast } from "@/lib/toast";
import type { CategorySlug, DeliveryMethod, Listing } from "@/lib/types";
import type { FieldErrors } from "@/lib/validation";

const HUES = [265, 220, 190, 160, 45, 20, 350, 305];

const DELIVERY: { value: DeliveryMethod; label: string }[] = [
  { value: "chat", label: "Передача в чате заказа" },
  { value: "key", label: "Цифровой ключ / код" },
  { value: "manual", label: "Выполняю вручную" },
  { value: "file", label: "Файл или ссылка на скачивание" },
];

export function ListingForm({ existing }: { existing?: Listing }) {
  const router = useRouter();
  const s = useDemoState();
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [form, setForm] = useState({
    title: existing?.title ?? "",
    categorySlug: (existing?.categorySlug ?? "design") as CategorySlug,
    description: existing?.description ?? "",
    price: existing ? String(existing.priceUzs) : "",
    deliveryMethod: (existing?.deliveryMethod ?? "chat") as DeliveryMethod,
    deliveryDays: existing ? String(existing.deliveryDays) : "1",
    refundTerms: existing?.refundTerms ?? "Возврат возможен до начала выполнения. После передачи — через спор, если товар не соответствует описанию.",
    fulfillmentTerms: existing?.fulfillmentTerms ?? "Продавец передаёт товар через чат заказа и отмечает заказ как «Выдан». Покупатель подтверждает получение.",
    imageHue: existing?.imageHue ?? categories.find((c) => c.slug === (existing?.categorySlug ?? "design"))?.hue ?? 265,
  });

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  function toNumber(v: string): number {
    const t = v.replace(/\s/g, "");
    return t === "" ? NaN : Number(t);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const input = {
      title: form.title,
      categorySlug: form.categorySlug,
      description: form.description,
      priceUzs: toNumber(form.price),
      deliveryMethod: form.deliveryMethod,
      deliveryDays: toNumber(form.deliveryDays),
      refundTerms: form.refundTerms,
      fulfillmentTerms: form.fulfillmentTerms,
      imageHue: form.imageHue,
    };
    const r = existing ? updateListing(existing.id, input) : createListing(input);
    setBusy(false);
    if (!r.ok) {
      setErrors(r.fieldErrors ?? {});
      if (!r.fieldErrors) toast.error(r.error);
      else toast.error("Проверьте поля формы");
      return;
    }
    setErrors({});
    toast.success(existing ? "Изменения сохранены" : "Объявление опубликовано");
    router.push(existing ? "/seller" : `/listing/${r.data.id}`);
  }

  const price = toNumber(form.price);
  const enabledCategories = categories.filter((c) => !s.disabledCategories.includes(c.slug) || c.slug === existing?.categorySlug);

  return (
    <form onSubmit={onSubmit} className="grid gap-8 xl:grid-cols-[1fr_20rem]" noValidate>
      <div className="card space-y-5 p-5 sm:p-6">
        <Field label="Название" htmlFor="title" error={errors.title} hint="5–120 символов. Чётко опишите, что получит покупатель.">
          <input id="title" className="input" value={form.title} onChange={(e) => set("title", e.target.value)} maxLength={120} />
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Категория" htmlFor="category" error={errors.categorySlug}>
            <select id="category" className="input" value={form.categorySlug} onChange={(e) => set("categorySlug", e.target.value as CategorySlug)}>
              {enabledCategories.map((c) => (
                <option key={c.slug} value={c.slug}>{c.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Цена, сум" htmlFor="price" error={errors.priceUzs} hint={Number.isFinite(price) && price > 0 ? formatUZS(price) : "Целое число, от 1 000 сум"}>
            <input id="price" inputMode="numeric" className="input" value={form.price} onChange={(e) => set("price", e.target.value)} placeholder="150000" />
          </Field>
        </div>

        <Field label="Описание" htmlFor="description" error={errors.description} hint={`${form.description.length}/3000`}>
          <textarea id="description" rows={6} className="input" value={form.description} onChange={(e) => set("description", e.target.value)} maxLength={3000} />
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Способ передачи товара" htmlFor="delivery" error={errors.deliveryMethod}>
            <select id="delivery" className="input" value={form.deliveryMethod} onChange={(e) => set("deliveryMethod", e.target.value as DeliveryMethod)}>
              {DELIVERY.map((d) => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Срок выполнения, дней" htmlFor="days" error={errors.deliveryDays} hint="0 — выполняется сразу">
            <input id="days" inputMode="numeric" className="input" value={form.deliveryDays} onChange={(e) => set("deliveryDays", e.target.value)} />
          </Field>
        </div>

        <Field label="Условия выполнения" htmlFor="fulfil" error={errors.fulfillmentTerms}>
          <textarea id="fulfil" rows={3} className="input" value={form.fulfillmentTerms} onChange={(e) => set("fulfillmentTerms", e.target.value)} maxLength={1000} />
        </Field>
        <Field label="Условия возврата" htmlFor="refund" error={errors.refundTerms} hint="Должны соответствовать правилам площадки.">
          <textarea id="refund" rows={3} className="input" value={form.refundTerms} onChange={(e) => set("refundTerms", e.target.value)} maxLength={1000} />
        </Field>

        <div className="flex flex-wrap gap-3">
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy && <Spinner />} {existing ? "Сохранить изменения" : "Опубликовать"}
          </button>
          <button type="button" className="btn-ghost" onClick={() => router.back()}>Отмена</button>
        </div>
      </div>

      <aside className="space-y-4">
        <div className="card p-5">
          <p className="mb-3 text-sm font-semibold">Изображение</p>
          <ListingImage slug={form.categorySlug} hue={form.imageHue} className="aspect-[16/10] w-full rounded-xl" />
          <p className="mb-2 mt-4 text-xs text-muted">Цвет обложки:</p>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Цвет обложки">
            {HUES.map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => set("imageHue", h)}
                aria-label={`Цвет ${h}`}
                aria-pressed={form.imageHue === h}
                className={`h-8 w-8 rounded-full border-2 transition ${form.imageHue === h ? "border-white" : "border-transparent"}`}
                style={{ background: `linear-gradient(135deg, hsl(${h} 70% 50%), hsl(${(h + 50) % 360} 70% 35%))` }}
              />
            ))}
          </div>
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-dashed border-line p-3 text-xs text-muted">
            <ImagePlus className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>Загрузка собственных фото появится вместе с Supabase Storage. Пока используется локальная заглушка.</span>
          </div>
        </div>
        <Notice>
          Товары и услуги должны быть разрешены законом и правилами сторонних сервисов. Продажа аккаунтов допустима, только если это не запрещено правилами соответствующего сервиса.
        </Notice>
      </aside>
    </form>
  );
}
