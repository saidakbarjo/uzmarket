"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { AuthShell } from "@/components/auth-shell";
import { Field, Notice } from "@/components/ui";
import { recoverySchema, zodErrors, type FieldErrors } from "@/lib/validation";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [sent, setSent] = useState(false);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const parsed = recoverySchema.safeParse({ email });
    if (!parsed.success) {
      setErrors(zodErrors(parsed.error));
      return;
    }
    setErrors({});
    // Не раскрываем, существует ли такой e-mail. Реальная отправка письма появится с Supabase Auth.
    setSent(true);
  }

  return (
    <AuthShell title="Восстановление пароля" subtitle="Укажите e-mail, привязанный к аккаунту.">
      {sent ? (
        <div className="space-y-4">
          <Notice tone="ok">Если такой аккаунт существует, мы отправили бы письмо со ссылкой для сброса.</Notice>
          <Notice tone="warn">В демо-режиме письма не отправляются: почтового сервиса пока нет. Для входа используйте тестовые аккаунты или создайте новый.</Notice>
          <Link href="/login" className="btn-ghost w-full">Вернуться ко входу</Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <Field label="E-mail" htmlFor="email" error={errors.email}>
            <input id="email" type="email" autoComplete="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </Field>
          <button type="submit" className="btn-primary w-full">Отправить ссылку</button>
          <Link href="/login" className="block text-center text-sm text-muted hover:text-ink">Назад ко входу</Link>
        </form>
      )}
    </AuthShell>
  );
}
