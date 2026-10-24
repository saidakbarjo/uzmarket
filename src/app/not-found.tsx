import Link from "next/link";
import { Compass } from "lucide-react";

export default function NotFound() {
  return (
    <div className="card mx-auto flex max-w-md flex-col items-center gap-3 px-6 py-14 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-panel-2 text-accent">
        <Compass className="h-7 w-7" aria-hidden />
      </div>
      <p className="font-display text-5xl font-extrabold text-line">404</p>
      <h1 className="font-display text-xl font-semibold">Страница не найдена</h1>
      <p className="text-sm text-muted">Возможно, ссылка устарела или была введена с ошибкой.</p>
      <div className="mt-2 flex gap-2">
        <Link href="/" className="btn-primary">На главную</Link>
        <Link href="/catalog" className="btn-ghost">В каталог</Link>
      </div>
    </div>
  );
}
