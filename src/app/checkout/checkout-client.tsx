"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { useState } from "react";
import { RequireAuth } from "@/components/require-auth";
import { EmptyState, ListingImage, Notice, PageHeader, Spinner } from "@/components/ui";
import { PAYER_LABELS, SOURCE_LABELS } from "@/lib/commission";
import { formatUZS } from "@/lib/money";
import { createOrder, quoteFor, useDemoState } from "@/lib/store";
import { DEMO_BANNER } from "@/lib/payments/provider";
import { toast } from "@/lib/toast";

/**
 * Подтверждение заказа: показывает, сколько заплатит покупатель и сколько получит продавец, ДО создания заказа.
 * Расчёт делается по данным хранилища (цена, ставка), а не по значениям из адресной строки:
 * из URL берётся только количество, и оно проверяется заново при создании заказа.
 */
export function CheckoutClient() {
  const params = useSearchParams();
  const id = params.get("id") ?? "";
  const qty = Math.floor(Number(params.get("qty") ?? 1)) || 1;
  const router = useRouter();
  const s = useDemoState();
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);

  return (
    <RequireAuth>
      {(user) => {
        const listing = s.listings.find((l) => l.id === id);
        if (!listing) return <EmptyState title="Товар не найден" action={{ href: "/catalog", label: "В каталог" }} />;
        const q = quoteFor(s, id, qty);
        const seller = s.profiles.find((p) => p.id === listing.sellerId);
        const own = listing.sellerId === user.id;

        function confirm() {
          setBusy(true);
          const r = createOrder(id, qty);
          setBusy(false);
          if (!r.ok) return toast.error(r.error);
          toast.success(`Заказ ${r.data.number} создан. Осталось тестово оплатить.`);
          router.push(`/orders?id=${r.data.id}`);
        }

        return (
          <div className="mx-auto max-w-3xl">
            <PageHeader title="Подтверждение заказа" subtitle="Проверьте сумму и условия. Заказ создаётся с зафиксированной ценой и комиссией." />
            <div className="card space-y-5 p-5 sm:p-6">
              <div className="flex gap-4">
                <ListingImage gameSlug={listing.gameSlug} images={listing.images} type={listing.productType} seed={listing.id} className="aspect-[16/10] w-32 shrink-0 rounded-xl" />
                <div className="min-w-0">
                  <Link href={`/listing?id=${listing.id}`} className="font-semibold hover:text-accent">{listing.title}</Link>
                  <p className="mt-1 text-sm text-muted">Продавец: {seller?.username}</p>
                </div>
              </div>

              {own && <Notice tone="warn">Нельзя купить собственный товар.</Notice>}

              {q.ok ? (
                <dl className="space-y-2 text-sm" data-testid="checkout-summary">
                  <div className="flex justify-between gap-3"><dt className="text-muted">Цена за единицу</dt><dd>{formatUZS(q.data.unitPriceUzs)}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-muted">Количество</dt><dd>{q.data.quantity}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-muted">Стоимость товара</dt><dd>{formatUZS(q.data.priceUzs)}</dd></div>
                  {q.data.commission.buyerFeeUzs > 0 && (
                    <div className="flex justify-between gap-3"><dt className="text-muted">Сервисный сбор покупателя</dt><dd>+{formatUZS(q.data.commission.buyerFeeUzs)}</dd></div>
                  )}
                  <div className="flex justify-between gap-3 border-t border-line pt-3 text-base font-semibold"><dt>Итого к оплате</dt><dd className="font-display text-xl">{formatUZS(q.data.commission.totalUzs)}</dd></div>
                  <div className="rounded-xl bg-panel-2 p-3 text-xs text-muted">
                    <p className="font-semibold text-ink">Комиссия площадки: {q.data.commission.percent}% = {formatUZS(q.data.commission.feeUzs)}</p>
                    <p className="mt-1">Ставка: {SOURCE_LABELS[q.data.commission.source]}. Комиссию платит: {PAYER_LABELS[q.data.commission.payer]}.</p>
                    <p className="mt-1">Продавец получит: <b className="text-ink">{formatUZS(q.data.commission.sellerNetUzs)}</b> после завершения заказа.</p>
                  </div>
                </dl>
              ) : (
                <Notice tone="danger">{q.error}</Notice>
              )}

              <div className="space-y-2 text-sm text-muted">
                <p><b className="text-ink">Условия передачи:</b> {listing.fulfillmentTerms}</p>
                <p><b className="text-ink">Условия возврата:</b> {listing.refundTerms}</p>
              </div>

              <Notice tone="warn">
                <b>{DEMO_BANNER}.</b> Оплата тестовая. Это не эскроу и не реальное удержание средств: статусы показывают порядок будущего процесса.
              </Notice>

              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" className="mt-1 h-4 w-4 accent-[var(--color-accent)]" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
                <span>Я проверил(а) сумму и условия и согласен(на) с <Link href="/legal/rules" className="text-accent hover:underline">правилами площадки</Link>.</span>
              </label>

              <div className="flex flex-wrap gap-3">
                <button type="button" className="btn-primary" disabled={!agree || !q.ok || own || busy} onClick={confirm}>
                  {busy ? <Spinner /> : <ShieldCheck className="h-4 w-4" aria-hidden />} Подтвердить заказ
                </button>
                <Link href={`/listing?id=${listing.id}`} className="btn-ghost">Назад к товару</Link>
              </div>
            </div>
          </div>
        );
      }}
    </RequireAuth>
  );
}
