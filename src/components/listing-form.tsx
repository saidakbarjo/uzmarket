"use client";

import { useRouter } from "next/navigation";
import { Eye, ImagePlus, Pencil, Trash2 } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import { ListingCard } from "@/components/listing-card";
import { Field, ListingImage, Notice, Spinner } from "@/components/ui";
import { calcCommission, PAYER_LABELS } from "@/lib/commission";
import { resizeImage } from "@/lib/image-utils";
import { formatUZS } from "@/lib/money";
import { PRODUCT_TYPES, DELIVERY_LABELS } from "@/lib/product-types";
import { createListing, updateListing, useCurrentUser, useDemoState } from "@/lib/store";
import { toast } from "@/lib/toast";
import type { DeliveryMethod, Listing, ProductType } from "@/lib/types";
import type { FieldErrors } from "@/lib/validation";

const MAX_IMAGES = 4;

export function ListingForm({ existing }: { existing?: Listing }) {
  const router = useRouter();
  const s = useDemoState();
  const { user } = useCurrentUser();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const enabledGames = s.games.filter((g) => g.enabled || g.slug === existing?.gameSlug).sort((a, b) => a.sortOrder - b.sortOrder);
  const [form, setForm] = useState({
    title: existing?.title ?? "",
    gameSlug: existing?.gameSlug ?? enabledGames[0]?.slug ?? "",
    productType: (existing?.productType ?? "item") as ProductType,
    description: existing?.description ?? "",
    price: existing ? String(existing.priceUzs) : "",
    stock: existing ? (existing.stock === null ? "" : String(existing.stock)) : "1",
    available: existing?.available ?? true,
    deliveryMethod: (existing?.deliveryMethod ?? "chat") as DeliveryMethod,
    deliveryDays: existing ? String(existing.deliveryDays) : "0",
    refundTerms: existing?.refundTerms ?? "Возврат возможен до передачи товара. После передачи — через спор, если товар не соответствует описанию.",
    fulfillmentTerms: existing?.fulfillmentTerms ?? "Передаю товар через чат заказа и отмечаю заказ как «Товар передан». Покупатель подтверждает получение.",
    images: existing?.images ?? ([] as string[]),
  });

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));
  const typeInfo = PRODUCT_TYPES.find((t) => t.value === form.productType)!;

  function toNumber(v: string): number {
    const t = v.replace(/\s/g, "");
    return t === "" ? NaN : Number(t);
  }

  function buildInput() {
    return {
      title: form.title,
      gameSlug: form.gameSlug,
      productType: form.productType,
      description: form.description,
      priceUzs: toNumber(form.price),
      stock: form.stock.trim() === "" ? null : toNumber(form.stock),
      available: form.available,
      deliveryMethod: form.deliveryMethod,
      deliveryDays: toNumber(form.deliveryDays),
      refundTerms: form.refundTerms,
      fulfillmentTerms: form.fulfillmentTerms,
      images: form.images,
      imageHue: existing?.imageHue,
    };
  }

  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const room = MAX_IMAGES - form.images.length;
    if (room <= 0) return toast.error(`Не более ${MAX_IMAGES} изображений`);
    const next: string[] = [];
    for (const f of Array.from(files).slice(0, room)) {
      try {
        next.push(await resizeImage(f, 800));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Не удалось добавить изображение");
      }
    }
    if (next.length) setForm((f) => ({ ...f, images: [...f.images, ...next] }));
    if (fileRef.current) fileRef.current.value = "";
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const input = buildInput();
    const r = existing ? updateListing(existing.id, input) : createListing(input);
    setBusy(false);
    if (!r.ok) {
      setErrors(r.fieldErrors ?? {});
      if (r.fieldErrors) toast.error("Проверьте поля формы");
      else toast.error(r.error);
      return;
    }
    setErrors({});
    const pending = r.data.status === "pending";
    toast.success(existing ? (pending ? "Сохранено и отправлено на модерацию" : "Изменения сохранены") : pending ? "Объявление отправлено на модерацию" : "Объявление опубликовано");
    router.push(existing || pending ? "/seller" : `/listing?id=${r.data.id}`);
  }

  const price = toNumber(form.price);
  const priceOk = Number.isFinite(price) && price >= 1000;
  const commission = priceOk && user ? calcCommission(price, s.commission, { gameSlug: form.gameSlug, sellerId: user.id }) : null;
  const previewListing: Listing = {
    id: "preview",
    sellerId: user?.id ?? "",
    title: form.title || "Название товара",
    description: form.description,
    gameSlug: form.gameSlug,
    productType: form.productType,
    priceUzs: priceOk ? price : 0,
    stock: form.stock.trim() === "" ? null : toNumber(form.stock),
    available: form.available,
    status: "active",
    deliveryMethod: form.deliveryMethod,
    deliveryDays: Number.isFinite(toNumber(form.deliveryDays)) ? toNumber(form.deliveryDays) : 0,
    refundTerms: form.refundTerms,
    fulfillmentTerms: form.fulfillmentTerms,
    images: form.images,
    createdAt: new Date().toISOString(),
    isDemo: false,
    views: 0,
  };

  return (
    <form onSubmit={onSubmit} className="grid gap-8 xl:grid-cols-[1fr_22rem]" noValidate>
      <div className="card space-y-5 p-5 sm:p-6">
        {s.settings.moderationEnabled && !existing && (
          <Notice tone="info">Включена модерация: объявление появится в каталоге после проверки администратором.</Notice>
        )}
        <Field label="Название" htmlFor="title" error={errors.title} hint="5–120 символов. Чётко опишите, что получит покупатель.">
          <input id="title" className="input" value={form.title} onChange={(e) => set("title", e.target.value)} maxLength={120} />
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Игра" htmlFor="game" error={errors.gameSlug}>
            <select id="game" className="input" value={form.gameSlug} onChange={(e) => set("gameSlug", e.target.value)}>
              {enabledGames.map((g) => (
                <option key={g.slug} value={g.slug}>{g.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Тип товара" htmlFor="ptype" error={errors.productType} hint={typeInfo.hint}>
            <select id="ptype" className="input" value={form.productType} onChange={(e) => set("productType", e.target.value as ProductType)}>
              {PRODUCT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Описание" htmlFor="description" error={errors.description} hint={`${form.description.length}/3000`}>
          <textarea id="description" rows={6} className="input" value={form.description} onChange={(e) => set("description", e.target.value)} maxLength={3000} />
        </Field>

        <div className="grid gap-5 sm:grid-cols-3">
          <Field label="Цена за единицу, сум" htmlFor="price" error={errors.priceUzs} hint={priceOk ? formatUZS(price) : "Целое число, от 1 000 сум"}>
            <input id="price" inputMode="numeric" className="input" value={form.price} onChange={(e) => set("price", e.target.value)} placeholder="150000" />
          </Field>
          <Field label="Количество" htmlFor="stock" error={errors.stock} hint={typeInfo.stockApplies ? "Сколько единиц в наличии" : "Пусто — без ограничения"}>
            <input id="stock" inputMode="numeric" className="input" value={form.stock} onChange={(e) => set("stock", e.target.value)} placeholder={typeInfo.stockApplies ? "1" : "без ограничения"} />
          </Field>
          <Field label="Срок выполнения, дней" htmlFor="days" error={errors.deliveryDays} hint="0 — выдаю сразу">
            <input id="days" inputMode="numeric" className="input" value={form.deliveryDays} onChange={(e) => set("deliveryDays", e.target.value)} />
          </Field>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="h-4 w-4 accent-[var(--color-accent)]" checked={form.available} onChange={(e) => set("available", e.target.checked)} />
          Товар в наличии (снимите галочку, чтобы временно показать «Нет в наличии»)
        </label>

        <Field label="Способ передачи товара" htmlFor="delivery" error={errors.deliveryMethod}>
          <select id="delivery" className="input" value={form.deliveryMethod} onChange={(e) => set("deliveryMethod", e.target.value as DeliveryMethod)}>
            {(Object.keys(DELIVERY_LABELS) as DeliveryMethod[]).map((d) => (
              <option key={d} value={d}>{DELIVERY_LABELS[d]}</option>
            ))}
          </select>
        </Field>
        <Field label="Условия передачи" htmlFor="fulfil" error={errors.fulfillmentTerms}>
          <textarea id="fulfil" rows={3} className="input" value={form.fulfillmentTerms} onChange={(e) => set("fulfillmentTerms", e.target.value)} maxLength={1000} />
        </Field>
        <Field label="Условия возврата" htmlFor="refund" error={errors.refundTerms} hint="Должны соответствовать правилам площадки.">
          <textarea id="refund" rows={3} className="input" value={form.refundTerms} onChange={(e) => set("refundTerms", e.target.value)} maxLength={1000} />
        </Field>

        <div>
          <p className="mb-2 text-sm font-medium">Изображения / скриншоты ({form.images.length}/{MAX_IMAGES})</p>
          <div className="flex flex-wrap gap-3">
            {form.images.map((src, i) => (
              <div key={i} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={`Изображение ${i + 1}`} className="h-20 w-28 rounded-lg border border-line object-cover" />
                <button
                  type="button"
                  onClick={() => set("images", form.images.filter((_, j) => j !== i))}
                  aria-label={`Удалить изображение ${i + 1}`}
                  className="absolute -right-2 -top-2 rounded-full bg-danger p-1 text-white"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
            {form.images.length < MAX_IMAGES && (
              <button type="button" onClick={() => fileRef.current?.click()} className="flex h-20 w-28 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-line text-xs text-muted hover:text-ink">
                <ImagePlus className="h-5 w-5" aria-hidden /> Добавить
              </button>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={(e) => onFiles(e.target.files)} aria-label="Загрузить изображения" />
          {errors.images && <p role="alert" className="mt-1 text-xs font-medium text-danger">{errors.images}</p>}
          <p className="mt-2 text-xs text-muted">JPG, PNG или WebP до 8 МБ; картинки уменьшаются в браузере. Не загружайте чужие персональные данные и пароли.</p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button type="button" className="btn-ghost" onClick={() => setPreview((v) => !v)} aria-pressed={preview}>
            {preview ? <Pencil className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />} {preview ? "Скрыть предпросмотр" : "Предпросмотр"}
          </button>
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy && <Spinner />} {existing ? "Сохранить изменения" : "Опубликовать"}
          </button>
          <button type="button" className="btn-ghost" onClick={() => router.back()}>Отмена</button>
        </div>
      </div>

      <aside className="space-y-4">
        {preview && (
          <div className="space-y-2" data-testid="listing-preview">
            <p className="text-sm font-semibold">Так увидят покупатели</p>
            <div className="pointer-events-none"><ListingCard listing={previewListing} /></div>
          </div>
        )}
        {!preview && (
          <div className="card p-5">
            <p className="mb-3 text-sm font-semibold">Обложка</p>
            <ListingImage gameSlug={form.gameSlug} images={form.images} type={form.productType} className="aspect-[16/10] w-full rounded-xl" />
          </div>
        )}
        <div className="card p-5 text-sm" aria-live="polite">
          <p className="mb-2 font-semibold">Ваш доход с одной продажи</p>
          {commission ? (
            <dl className="space-y-1.5">
              <div className="flex justify-between gap-3"><dt className="text-muted">Цена</dt><dd>{formatUZS(price)}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted">Комиссия {commission.percent}%</dt><dd>−{formatUZS(commission.feeUzs)}</dd></div>
              <div className="flex justify-between gap-3 border-t border-line pt-1.5 font-semibold"><dt>Вы получите</dt><dd>{formatUZS(commission.sellerNetUzs)}</dd></div>
              <p className="pt-1 text-xs text-muted">Платит комиссию: {PAYER_LABELS[commission.payer]}. Итоговая ставка фиксируется в заказе при его создании.</p>
            </dl>
          ) : (
            <p className="text-xs text-muted">Укажите цену — покажем комиссию и ваш доход.</p>
          )}
        </div>
        <Notice>
          Продавайте только то, что разрешено законом и правилами игры. Не передавайте пароли от чужих аккаунтов вне чата заказа.
        </Notice>
      </aside>
    </form>
  );
}
