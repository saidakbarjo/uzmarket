"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Lock, ShieldAlert } from "lucide-react";
import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui";
import { useCurrentUser } from "@/lib/store";
import type { Profile } from "@/lib/types";

/**
 * Защита страниц на клиенте для ДЕМО-режима.
 * Это удобство интерфейса, а не безопасность: настоящая проверка ролей —
 * серверная (Supabase Auth + RLS) и будет добавлена позже.
 */
export function RequireAuth({
  children,
  role,
}: {
  children: (user: Profile) => ReactNode;
  role?: "admin";
}) {
  const { user, ready } = useCurrentUser();
  const pathname = usePathname();

  if (!ready) {
    return (
      <div className="space-y-4" aria-busy>
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="card mx-auto flex max-w-md flex-col items-center gap-3 px-6 py-12 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-panel-2 text-accent">
          <Lock className="h-7 w-7" aria-hidden />
        </div>
        <h1 className="font-display text-xl font-semibold">Нужно войти в аккаунт</h1>
        <p className="text-sm text-muted">Эта страница доступна только авторизованным пользователям.</p>
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          <Link href={`/login?next=${encodeURIComponent(pathname)}`} className="btn-primary">
            Войти
          </Link>
          <Link href="/register" className="btn-ghost">
            Регистрация
          </Link>
        </div>
      </div>
    );
  }

  if (role === "admin" && user.role !== "admin") {
    return (
      <div className="card mx-auto flex max-w-md flex-col items-center gap-3 px-6 py-12 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-danger/10 text-danger">
          <ShieldAlert className="h-7 w-7" aria-hidden />
        </div>
        <h1 className="font-display text-xl font-semibold">Доступ запрещён</h1>
        <p className="text-sm text-muted">Для этого раздела нужны права администратора.</p>
        <Link href="/" className="btn-ghost mt-2">
          На главную
        </Link>
      </div>
    );
  }

  return <>{children(user)}</>;
}
