import type { ReactNode } from "react";
import { FlaskConical } from "lucide-react";
import { Notice } from "@/components/ui";

export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-md">
      <div className="card p-6 sm:p-8">
        <h1 className="font-display text-2xl font-bold">{title}</h1>
        {subtitle && <p className="mt-1.5 text-sm text-muted">{subtitle}</p>}
        <Notice tone="warn" className="mt-5">
          <span className="flex items-start gap-2">
            <FlaskConical className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>
              <b>Тестовый режим.</b> Это демонстрационная авторизация без сервера: данные хранятся только в вашем браузере. Это не защищённая система входа — в будущем её заменит Supabase Auth.
            </span>
          </span>
        </Notice>
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}

/** Разрешаем только внутренние пути, чтобы исключить open redirect. */
export function safeNext(value: string | null): string {
  if (!value) return "/account";
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/account";
  return value;
}
