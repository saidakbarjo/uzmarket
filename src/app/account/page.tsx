"use client";

import Link from "next/link";
import { BadgeCheck, CalendarDays, Package, Star, Store } from "lucide-react";
import { useState, type FormEvent } from "react";
import { RequireAuth } from "@/components/require-auth";
import { DemoBadge, Field, PageHeader, Stars, formatDate } from "@/components/ui";
import { updateProfile, useDemoState } from "@/lib/store";
import { toast } from "@/lib/toast";
import type { Profile } from "@/lib/types";
import type { FieldErrors } from "@/lib/validation";

function ProfileForm({ user }: { user: Profile }) {
  const [username, setUsername] = useState(user.username);
  const [about, setAbout] = useState(user.about);
  const [errors, setErrors] = useState<FieldErrors>({});

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const r = updateProfile({ username, about });
    if (r.ok) {
      setErrors({});
      toast.success("Профиль обновлён");
    } else {
      setErrors(r.fieldErrors ?? {});
      if (!r.fieldErrors) toast.error(r.error);
    }
  }

  return (
    <form onSubmit={onSubmit} className="card space-y-4 p-5 sm:p-6" noValidate>
      <h2 className="font-semibold">Редактировать профиль</h2>
      <Field label="Имя пользователя" htmlFor="username" error={errors.username}>
        <input id="username" className="input" value={username} onChange={(e) => setUsername(e.target.value)} maxLength={24} />
      </Field>
      <Field label="О себе" htmlFor="about" error={errors.about} hint="До 300 символов. Показывается в профиле продавца.">
        <textarea id="about" rows={3} className="input" value={about} onChange={(e) => setAbout(e.target.value)} maxLength={300} />
      </Field>
      <button type="submit" className="btn-primary">Сохранить</button>
    </form>
  );
}

export default function AccountPage() {
  const s = useDemoState();
  return (
    <RequireAuth>
      {(user) => {
        const listings = s.listings.filter((l) => l.sellerId === user.id);
        const purchases = s.orders.filter((o) => o.buyerId === user.id).length;
        const sales = s.orders.filter((o) => o.sellerId === user.id).length;
        return (
          <div>
            <PageHeader title="Мой профиль" subtitle="Основные данные аккаунта и быстрые ссылки." />
            <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
              <div className="space-y-6">
                <div className="card flex flex-wrap items-center gap-4 p-5 sm:p-6">
                  <span className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-accent to-accent-2 font-display text-2xl font-bold text-white">
                    {user.username.slice(0, 1).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 font-display text-xl font-bold">
                      {user.username}
                      {user.verified && <BadgeCheck className="h-5 w-5 text-accent-2" aria-label="Проверенный" />}
                      {user.isDemo && <DemoBadge label="Тестовый профиль" />}
                    </p>
                    <p className="truncate text-sm text-muted">{user.email}</p>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">
                      <CalendarDays className="h-3.5 w-3.5" aria-hidden /> С нами с {formatDate(user.createdAt)}
                      {user.role === "admin" && <span className="ml-2 rounded bg-accent/15 px-1.5 py-0.5 font-semibold text-accent">Администратор</span>}
                    </p>
                  </div>
                </div>
                <ProfileForm key={user.id + user.username} user={user} />
              </div>

              <div className="space-y-4">
                <div className="card grid grid-cols-3 gap-3 p-5 text-center">
                  <div><p className="font-display text-2xl font-bold">{purchases}</p><p className="text-xs text-muted">Покупок</p></div>
                  <div><p className="font-display text-2xl font-bold">{sales}</p><p className="text-xs text-muted">Продаж</p></div>
                  <div><p className="font-display text-2xl font-bold">{listings.length}</p><p className="text-xs text-muted">Объявл.</p></div>
                </div>
                <div className="card p-5">
                  <p className="mb-2 flex items-center gap-2 text-sm font-semibold"><Star className="h-4 w-4 text-warn" aria-hidden /> Рейтинг продавца</p>
                  {user.reviewsCount ? (
                    <p className="flex items-center gap-2"><Stars value={user.rating} /> <b>{user.rating.toFixed(1)}</b> <span className="text-sm text-muted">({user.reviewsCount})</span></p>
                  ) : (
                    <p className="text-sm text-muted">Пока нет отзывов.</p>
                  )}
                </div>
                <div className="card space-y-2 p-5">
                  <Link href="/seller" className="btn-ghost w-full"><Store className="h-4 w-4" aria-hidden /> Кабинет продавца</Link>
                  <Link href="/seller/new" className="btn-primary w-full"><Package className="h-4 w-4" aria-hidden /> Создать объявление</Link>
                </div>
              </div>
            </div>
          </div>
        );
      }}
    </RequireAuth>
  );
}
