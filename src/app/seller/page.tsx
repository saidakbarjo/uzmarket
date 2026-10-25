"use client";

import Link from "next/link";
import { Eye, Pause, Pencil, Play, Plus, ShoppingBag, Store, Trash2 } from "lucide-react";
import { RequireAuth } from "@/components/require-auth";
import { Badge, ConfirmButton, DemoBadge, EmptyState, ListingImage, PageHeader } from "@/components/ui";
import { formatUZS } from "@/lib/money";
import { deleteListing, setListingStatus, useDemoState } from "@/lib/store";
import { toast } from "@/lib/toast";

const STATUS = {
  active: { label: "Опубликовано", tone: "ok" as const },
  paused: { label: "Приостановлено", tone: "warn" as const },
  blocked: { label: "Заблокировано", tone: "danger" as const },
  pending: { label: "На модерации", tone: "warn" as const },
  rejected: { label: "Отклонено", tone: "danger" as const },
};

export default function SellerListingsPage() {
  const s = useDemoState();
  return (
    <RequireAuth>
      {(user) => {
        const mine = s.listings.filter((l) => l.sellerId === user.id);
        return (
          <div>
            <PageHeader
              title="Мои объявления"
              subtitle={`Всего: ${mine.length} · активных: ${mine.filter((l) => l.status === "active").length}`}
              actions={<Link href="/seller/new" className="btn-primary"><Plus className="h-4 w-4" aria-hidden /> Новое объявление</Link>}
            />
            {mine.length === 0 ? (
              <EmptyState icon={<Store className="h-7 w-7" aria-hidden />} title="У вас пока нет объявлений" text="Создайте первое объявление — оно сразу появится в каталоге." action={{ href: "/seller/new", label: "Создать объявление" }} />
            ) : (
              <ul className="space-y-3">
                {mine.map((l) => {
                  const st = STATUS[l.status];
                  return (
                    <li key={l.id} className="card flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
                      <ListingImage gameSlug={l.gameSlug} images={l.images} hue={l.imageHue} className="aspect-[16/10] w-full shrink-0 rounded-xl sm:w-40" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone={st.tone}>{st.label}</Badge>
                          <span className="text-xs text-muted">{s.games.find((g) => g.slug === l.gameSlug)?.name}</span>
                          {l.isDemo && <DemoBadge />}
                        </div>
                        <Link href={`/listing?id=${l.id}`} className="mt-1 block truncate font-semibold hover:text-accent">{l.title}</Link>
                        {l.moderationNote && <p className="mt-0.5 text-xs text-danger">Причина: {l.moderationNote}</p>}
                        <p className="mt-0.5 flex items-center gap-3 text-sm text-muted">
                          <span className="font-semibold text-ink">{formatUZS(l.priceUzs)}</span>
                          <span className="flex items-center gap-1" title="Просмотры"><Eye className="h-3.5 w-3.5" aria-hidden /> {l.views}</span>
                          <span className="flex items-center gap-1" title="Заказы"><ShoppingBag className="h-3.5 w-3.5" aria-hidden /> {s.orders.filter((o) => o.listingId === l.id).length}</span>
                          <span>{l.stock === null ? "∞" : `${l.stock} шт.`}{!l.available && " · нет в наличии"}</span>
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Link href={`/seller/edit?id=${l.id}`} className="btn-ghost !px-3 !py-2"><Pencil className="h-4 w-4" aria-hidden /> Изменить</Link>
                        {l.status === "active" && (
                          <ConfirmButton
                            label="Приостановить"
                            className="btn-ghost !px-3 !py-2"
                            icon={<Pause className="h-4 w-4" aria-hidden />}
                            title="Приостановить публикацию?"
                            description="Объявление пропадёт из каталога. Существующие заказы не пострадают. Возобновить можно в любой момент."
                            confirmLabel="Приостановить"
                            onConfirm={() => {
                              const r = setListingStatus(l.id, "paused");
                              if (r.ok) toast.success("Публикация приостановлена");
                              else toast.error(r.error);
                            }}
                          />
                        )}
                        {l.status === "paused" && (
                          <button
                            type="button"
                            className="btn-ghost !px-3 !py-2"
                            onClick={() => {
                              const r = setListingStatus(l.id, "active");
                              if (r.ok) toast.success("Объявление снова в каталоге");
                              else toast.error(r.error);
                            }}
                          >
                            <Play className="h-4 w-4" aria-hidden /> Возобновить
                          </button>
                        )}
                        <ConfirmButton
                          label="Удалить"
                          className="btn-danger !px-3 !py-2"
                          icon={<Trash2 className="h-4 w-4" aria-hidden />}
                          title="Удалить объявление?"
                          description="Объявление будет удалено без возможности восстановления. Если по нему есть незавершённые заказы, удаление будет отклонено."
                          confirmLabel="Удалить"
                          onConfirm={() => {
                            const r = deleteListing(l.id);
                            if (r.ok) toast.success("Объявление удалено");
                            else toast.error(r.error);
                          }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      }}
    </RequireAuth>
  );
}
