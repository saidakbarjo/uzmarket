"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { AuthShell, safeNext } from "@/components/auth-shell";
import { Badge, Field, Spinner } from "@/components/ui";
import { DEMO_PASSWORD } from "@/lib/data/seed";
import { login } from "@/lib/store";
import { toast } from "@/lib/toast";
import type { FieldErrors } from "@/lib/validation";

const TEST_ACCOUNTS = [
  { email: "saidakbar@uzmarket.demo", label: "Saidakbar — основатель, руководитель и администратор", tone: "accent" as const },
  { email: "u-nur@uzmarket.demo", label: "NurGameShop — продавец (заказы, баланс)", tone: "neutral" as const },
  { email: "u-timur@uzmarket.demo", label: "TimurSkins — продавец и покупатель (есть покупки, заявка на вывод)", tone: "neutral" as const },
];

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    setFormError("");
    const r = await login({ email, password });
    setBusy(false);
    if (!r.ok) {
      setErrors(r.fieldErrors ?? {});
      setFormError(r.fieldErrors ? "" : r.error);
      return;
    }
    toast.success(`Добро пожаловать, ${r.data.username}!`);
    router.push(safeNext(params.get("next")));
  }

  return (
    <AuthShell title="Вход" subtitle="Войдите, чтобы покупать, продавать и следить за заказами.">
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field label="E-mail" htmlFor="email" error={errors.email}>
          <input id="email" type="email" autoComplete="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </Field>
        <Field label="Пароль" htmlFor="password" error={errors.password}>
          <input id="password" type="password" autoComplete="current-password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </Field>
        {formError && <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{formError}</p>}
        <button type="submit" className="btn-primary w-full" disabled={busy}>
          {busy && <Spinner />} Войти
        </button>
        <div className="flex flex-wrap justify-between gap-2 text-sm">
          <Link href="/forgot-password" className="text-accent hover:underline">Забыли пароль?</Link>
          <Link href="/register" className="text-muted hover:text-ink">Создать аккаунт</Link>
        </div>
      </form>

      <div className="mt-6 rounded-xl border border-line bg-panel-2 p-4">
        <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
          Тестовые аккаунты <Badge tone="warn">DEMO</Badge>
        </p>
        <p className="mb-3 text-xs text-muted">Публичный тестовый пароль: <code className="rounded bg-bg px-1.5 py-0.5 text-ink">{DEMO_PASSWORD}</code></p>
        <ul className="space-y-2">
          {TEST_ACCOUNTS.map((a) => (
            <li key={a.email}>
              <button
                type="button"
                className="w-full rounded-lg border border-line px-3 py-2 text-left text-xs transition hover:border-accent/60"
                onClick={() => {
                  setEmail(a.email);
                  setPassword(DEMO_PASSWORD);
                }}
              >
                <span className="block font-medium text-ink">{a.label}</span>
                <span className="text-muted">{a.email}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </AuthShell>
  );
}
