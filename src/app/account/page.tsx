"use client";

import Link from "next/link";
import { BadgeCheck, CalendarDays, Package, Star, Store } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import { RequireAuth } from "@/components/require-auth";
import { Avatar, DemoBadge, Field, PageHeader, Stars, formatDate } from "@/components/ui";
import { resizeImage } from "@/lib/image-utils";
import { updateProfile, useDemoState } from "@/lib/store";
import { toast } from "@/lib/toast";
import type { Profile } from "@/lib/types";
import type { FieldErrors } from "@/lib/validation";

function ProfileForm({ user }: { user: Profile }) {
  const [username, setUsername] = useState(user.username);
  const [about, setAbout] = useState(user.about);
  const [avatar, setAvatar] = useState(user.avatar ?? "hue:250");
  const fileRef = useRef<HTMLInputElement>(null);
  const HUES = [265, 220, 190, 160, 45, 20, 350, 305];

  async function onFile(f: File | undefined) {
    if (!f) return;
    try {
      const url = await resizeImage(f, 160, 0.8);
      setAvatar(url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось загрузить изображение");
    }
  }
  const [errors, setErrors] = useState<FieldErrors>({});

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const r = updateProfile({ username, about, avatar });
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
      <div>
        <p className="mb-2 text-sm font-medium">Аватар</p>
        <div className="flex flex-wrap items-center gap-3">
          <Avatar user={{ username, avatar }} className="h-14 w-14" />
          <div className="flex flex-wrap gap-2" role="group" aria-label="Цвет аватара">
            {HUES.map((h) => (
              <button key={h} type="button" aria-label={`Цвет ${h}`} aria-pressed={avatar === `hue:${h}`} onClick={() => setAvatar(`hue:${h}`)} className={`h-7 w-7 rounded-full border-2 ${avatar === `hue:${h}` ? "border-white" : "border-transparent"}`} style={{ background: `linear-gradient(135deg, hsl(${h} 65% 48%), hsl(${(h + 60) % 360} 60% 30%))` }} />
            ))}
          </div>
          <button type="button" className="btn-ghost !py-1.5 !text-xs" onClick={() => fileRef.current?.click()}>Загрузить фото</button>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label="Загрузить аватар" onChange={(e) => onFile(e.target.files?.[0])} />
        </div>
      </div>
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
                  <Avatar user={user} className="h-16 w-16 !text-2xl" />
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
                  <Link href="/seller" className="btn-ghost w-full"><Store className="h-4 w-4" aria-hidden /> {user.isSeller ? "Кабинет продавца" : "Стать продавцом"}</Link>
                  {user.isSeller && <Link href="/seller/new" className="btn-primary w-full"><Package className="h-4 w-4" aria-hidden /> Продать товар</Link>}
                </div>
              </div>
            </div>
          </div>
        );
      }}
    </RequireAuth>
  );
}
