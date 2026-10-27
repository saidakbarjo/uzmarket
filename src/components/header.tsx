"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, Heart, LayoutDashboard, LogOut, Menu, Plus, Search, Shield, Store, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import { LANGS, setLang, useLang, useT, type Lang } from "@/lib/i18n";
import { logout, useCurrentUser, useDemoState } from "@/lib/store";
import { DEMO_BANNER } from "@/lib/payments/provider";
import { toast } from "@/lib/toast";
import { useGuestFavorites } from "@/lib/guest";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link href="/" className={`flex items-center gap-2.5 ${className}`} aria-label="UZMARKET — на главную">
      <svg viewBox="0 0 36 36" className="h-9 w-9 shrink-0" aria-hidden>
        <path d="M18 1 35 18 18 35 1 18Z" fill="#7b6cff" />
        <path d="M18 8 28 18 18 28 8 18Z" fill="#13141a" />
        <path d="M13.5 13v6a4.5 4.5 0 0 0 9 0v-6" fill="none" stroke="#f5b544" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
      <span className="font-display text-[17px] font-bold leading-none tracking-tight">
        UZMARKET <span className="font-medium text-accent">gaming</span>
      </span>
    </Link>
  );
}

const nextLang = (l: Lang): Lang => LANGS[(LANGS.indexOf(l) + 1) % LANGS.length];

export function Header() {
  const t = useT();
  const lang = useLang();
  const router = useRouter();
  const pathname = usePathname();
  const { user, ready } = useCurrentUser();
  const s = useDemoState();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const guestFavs = useGuestFavorites();
  const favCount = user ? (s.favorites[user.id] ?? []).length : guestFavs.length;
  const unread = user ? s.notifications.filter((n) => n.userId === user.id && !n.read).length : 0;

  function onSearch(e: FormEvent) {
    e.preventDefault();
    setOpen(false);
    router.push(q.trim() ? `/catalog?q=${encodeURIComponent(q.trim())}` : "/catalog");
  }

  function onLogout() {
    logout();
    setOpen(false);
    toast.info("Вы вышли из аккаунта");
    router.push("/");
  }

  const link = (href: string, label: string) => (
    <Link
      href={href}
      onClick={() => setOpen(false)}
      className={`rounded-lg px-3 py-2 text-sm font-medium transition hover:bg-panel-2 ${pathname === href || pathname.startsWith(href + "/") ? "text-ink" : "text-muted"}`}
    >
      {label}
    </Link>
  );

  return (
    <>
      <div className="border-b border-warn/20 bg-warn/10 px-4 py-1.5 text-center text-xs font-semibold tracking-wide text-warn">
        {lang === "ru" ? DEMO_BANNER : `${DEMO_BANNER} · ${t("demo.banner")}`}
      </div>
      <header className="sticky top-0 z-40 border-b border-line bg-bg/80 backdrop-blur-xl">
        <div className="container-page flex h-16 items-center gap-3">
          <Logo className="shrink-0" />

          <form onSubmit={onSearch} role="search" className="relative hidden min-w-0 flex-1 md:block md:max-w-xl lg:mx-4">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="input pl-10"
              placeholder={t("search.placeholder")}
              aria-label="Поиск"
              maxLength={100}
            />
          </form>

          <nav className="ml-auto hidden items-center gap-1 lg:flex" aria-label="Основная навигация">
            {link("/catalog", t("nav.catalog"))}
            {link("/support", t("nav.support"))}
          </nav>

          <div className="ml-auto flex items-center gap-2 lg:ml-0">
            <button
              type="button"
              onClick={() => setLang(nextLang(lang))}
              className="hidden rounded-lg border border-line px-2.5 py-1.5 text-xs font-bold text-muted transition hover:text-ink sm:block"
              aria-label="Сменить язык интерфейса"
              title="RU / UZ / EN"
            >
              {nextLang(lang).toUpperCase()}
            </button>

            <Link href="/favorites" className="relative hidden rounded-lg p-2 text-muted hover:bg-panel-2 hover:text-ink sm:block" aria-label={`Избранное${favCount ? `: ${favCount}` : ""}`}>
              <Heart className="h-5 w-5" />
              {favCount > 0 && <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">{favCount}</span>}
            </Link>

            <Link href="/seller/new" className="btn-primary hidden !py-2 sm:inline-flex">
              <Plus className="h-4 w-4" aria-hidden /> {t("nav.sell")}
            </Link>

            {ready && user ? (
              <div className="hidden items-center gap-1 lg:flex">
                <Link href="/account/notifications" className="relative rounded-lg p-2 text-muted hover:bg-panel-2 hover:text-ink" aria-label={`Уведомления${unread ? `: ${unread} новых` : ""}`}>
                  <Bell className="h-5 w-5" />
                  {unread > 0 && (
                    <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-white">{unread}</span>
                  )}
                </Link>
                {user.isSeller && (
                  <Link href="/seller" className="btn-ghost !px-3 !py-2">
                    <Store className="h-4 w-4" aria-hidden /> Кабинет
                  </Link>
                )}
                {user.role === "admin" && (
                  <Link href="/admin" className="btn-ghost !px-3 !py-2">
                    <Shield className="h-4 w-4" aria-hidden /> Админ
                  </Link>
                )}
                <Link href="/account" className="btn-ghost !px-3 !py-2">
                  <LayoutDashboard className="h-4 w-4" aria-hidden /> {user.username}
                </Link>
                <button type="button" onClick={onLogout} className="rounded-lg p-2 text-muted hover:bg-panel-2 hover:text-ink" aria-label={t("nav.logout")}>
                  <LogOut className="h-5 w-5" />
                </button>
              </div>
            ) : (
              <div className="hidden items-center gap-2 lg:flex">
                <Link href="/login" className="btn-ghost !py-2">
                  {t("nav.login")}
                </Link>
                <Link href="/register" className="btn-ghost !py-2">
                  {t("nav.register")}
                </Link>
              </div>
            )}

            <button
              type="button"
              className="rounded-lg p-2 text-ink hover:bg-panel-2 lg:hidden"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-controls="mobile-menu"
              aria-label={open ? "Закрыть меню" : "Открыть меню"}
            >
              {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {open && (
          <div id="mobile-menu" className="animate-fade-up border-t border-line bg-bg px-4 pb-5 pt-3 lg:hidden">
            <form onSubmit={onSearch} role="search" className="relative mb-3">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
              <input value={q} onChange={(e) => setQ(e.target.value)} className="input pl-10" placeholder={t("search.placeholder")} aria-label="Поиск" maxLength={100} />
            </form>
            <div className="grid gap-1">
              {link("/catalog", t("nav.catalog"))}
              {link("/support", t("nav.support"))}
              {ready && user ? (
                <>
                  {link("/account", `${t("nav.account")} — ${user.username}`)}
                  {link("/account/notifications", `Уведомления${unread ? ` (${unread})` : ""}`)}
                  {user.isSeller && link("/seller", "Кабинет продавца")}
                  {user.role === "admin" && link("/admin", "Админ-панель")}
                  <button type="button" onClick={onLogout} className="rounded-lg px-3 py-2 text-left text-sm font-medium text-muted hover:bg-panel-2">
                    {t("nav.logout")}
                  </button>
                </>
              ) : (
                <>
                  {link("/login", t("nav.login"))}
                  {link("/register", t("nav.register"))}
                </>
              )}
            </div>
            <div className="mt-3 flex gap-2">
              <Link href="/seller/new" onClick={() => setOpen(false)} className="btn-primary flex-1">
                <Plus className="h-4 w-4" aria-hidden /> {t("nav.sell")}
              </Link>
              <button type="button" onClick={() => setLang(nextLang(lang))} className="btn-ghost" aria-label="Сменить язык интерфейса">
                {nextLang(lang).toUpperCase()}
              </button>
            </div>
          </div>
        )}
      </header>
    </>
  );
}
