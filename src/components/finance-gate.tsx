"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/ui";
import { DEMO_FINANCE } from "@/lib/flags";

/** Оборачивает финансовые страницы: пока нет реальных платежей — честная заглушка. */
export function FinanceGate({ children }: { children: ReactNode }) {
  if (DEMO_FINANCE) return <>{children}</>;
  return (
    <div className="space-y-4">
      <PageHeader title="Финансы и выплаты" subtitle="Раздел появится после подключения настоящей платёжной системы." />
      <div className="card p-5 text-sm text-muted">
        Сейчас сайт работает в тестовом режиме: заказы оформляются без реальных денег, поэтому баланс, прибыль и выплаты не показываются.
        <div className="mt-3"><Link href="/" className="btn-secondary">На главную</Link></div>
      </div>
    </div>
  );
}
