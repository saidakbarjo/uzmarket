"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { AuthShell } from "@/components/auth-shell";
import { Field, Spinner } from "@/components/ui";
import { register } from "@/lib/store";
import { toast } from "@/lib/toast";
import type { FieldErrors } from "@/lib/validation";

export function RegisterForm() {
  const router = useRouter();
  const [form, setForm] = useState({ username: "", email: "", password: "", agree: false });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.agree) {
      setErrors({ agree: "Необходимо принять соглашение" });
      return;
    }
    setBusy(true);
    setErrors({});
    const r = await register({ username: form.username, email: form.email, password: form.password });
    setBusy(false);
    if (!r.ok) {
      setErrors(r.fieldErrors ?? { _: r.error });
      return;
    }
    toast.success("Аккаунт создан (тестовый режим)");
    router.push("/account");
  }

  const set = (k: "username" | "email" | "password") => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <AuthShell title="Регистрация" subtitle="Создайте аккаунт за минуту. Пароль не сохраняется в открытом виде.">
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field label="Имя пользователя" htmlFor="username" error={errors.username} hint="3–24 символа: буквы, цифры, _ . -">
          <input id="username" autoComplete="username" className="input" value={form.username} onChange={set("username")} maxLength={24} required />
        </Field>
        <Field label="E-mail" htmlFor="email" error={errors.email}>
          <input id="email" type="email" autoComplete="email" className="input" value={form.email} onChange={set("email")} maxLength={120} required />
        </Field>
        <Field label="Пароль" htmlFor="password" error={errors.password} hint="Минимум 8 символов">
          <input id="password" type="password" autoComplete="new-password" className="input" value={form.password} onChange={set("password")} maxLength={100} required />
        </Field>
        <div>
          <label className="flex items-start gap-2.5 text-sm text-muted">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 accent-[var(--color-accent)]"
              checked={form.agree}
              onChange={(e) => setForm((f) => ({ ...f, agree: e.target.checked }))}
            />
            <span>
              Я принимаю <Link href="/legal/terms" className="text-accent hover:underline">пользовательское соглашение</Link> и{" "}
              <Link href="/legal/privacy" className="text-accent hover:underline">политику конфиденциальности</Link>
            </span>
          </label>
          {errors.agree && <p role="alert" className="mt-1.5 text-xs font-medium text-danger">{errors.agree}</p>}
        </div>
        {errors._ && <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{errors._}</p>}
        <button type="submit" className="btn-primary w-full" disabled={busy}>
          {busy && <Spinner />} Создать аккаунт
        </button>
        <p className="text-center text-sm text-muted">
          Уже есть аккаунт? <Link href="/login" className="text-accent hover:underline">Войти</Link>
        </p>
      </form>
    </AuthShell>
  );
}
