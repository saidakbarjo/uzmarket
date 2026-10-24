"use client";

import { TriangleAlert } from "lucide-react";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  // Технические детали ошибки пользователю не показываем.
  return (
    <div className="card mx-auto flex max-w-md flex-col items-center gap-3 px-6 py-14 text-center" role="alert">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-danger/10 text-danger">
        <TriangleAlert className="h-7 w-7" aria-hidden />
      </div>
      <h1 className="font-display text-xl font-semibold">Что-то пошло не так</h1>
      <p className="text-sm text-muted">Попробуйте обновить страницу. Если ошибка повторяется, напишите в поддержку.</p>
      <button type="button" onClick={reset} className="btn-primary mt-2">Попробовать снова</button>
    </div>
  );
}
