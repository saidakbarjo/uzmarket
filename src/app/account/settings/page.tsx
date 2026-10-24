"use client";

import { useRouter } from "next/navigation";
import { LogOut, RotateCcw } from "lucide-react";
import { RequireAuth } from "@/components/require-auth";
import { ConfirmButton, Notice, PageHeader } from "@/components/ui";
import { setLang, useLang } from "@/lib/i18n";
import { logout, resetDemoData } from "@/lib/store";
import { toast } from "@/lib/toast";

export default function SettingsPage() {
  const router = useRouter();
  const lang = useLang();
  return (
    <RequireAuth>
      {(user) => (
        <div className="space-y-6">
          <PageHeader title="Настройки" />

          <section className="card space-y-3 p-5 sm:p-6">
            <h2 className="font-semibold">Язык интерфейса</h2>
            <p className="text-sm text-muted">Основной язык — русский. Ключевые элементы доступны на узбекском.</p>
            <div className="flex gap-2" role="group" aria-label="Язык интерфейса">
              {(["ru", "uz"] as const).map((l) => (
                <button key={l} type="button" aria-pressed={lang === l} onClick={() => setLang(l)} className={lang === l ? "btn-primary" : "btn-ghost"}>
                  {l === "ru" ? "Русский" : "O‘zbekcha"}
                </button>
              ))}
            </div>
          </section>

          <section className="card space-y-3 p-5 sm:p-6">
            <h2 className="font-semibold">Аккаунт</h2>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div><dt className="text-muted">E-mail</dt><dd className="font-medium">{user.email}</dd></div>
              <div><dt className="text-muted">Роль</dt><dd className="font-medium">{user.role === "admin" ? "Администратор (демо)" : "Пользователь"}</dd></div>
            </dl>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                logout();
                toast.info("Вы вышли из аккаунта");
                router.push("/");
              }}
            >
              <LogOut className="h-4 w-4" aria-hidden /> Выйти
            </button>
          </section>

          <section className="card space-y-3 p-5 sm:p-6">
            <h2 className="font-semibold">Демонстрационные данные</h2>
            <Notice tone="warn">Все данные хранятся только в вашем браузере (localStorage). Сброс удалит созданные аккаунты, объявления, заказы и обращения и вернёт исходные тестовые данные.</Notice>
            <ConfirmButton
              label="Сбросить демо-данные"
              title="Сбросить все демо-данные?"
              description="Будут удалены все созданные вами в этом браузере аккаунты, объявления, заказы и обращения. Действие нельзя отменить."
              confirmLabel="Да, сбросить"
              icon={<RotateCcw className="h-4 w-4" aria-hidden />}
              onConfirm={() => {
                resetDemoData();
                toast.success("Демо-данные сброшены");
                router.push("/");
              }}
            />
          </section>
        </div>
      )}
    </RequireAuth>
  );
}
