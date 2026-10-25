"use client";

import {
  Banknote,
  Gamepad2,
  Gavel,
  History,
  Landmark,
  Percent,
  LayoutDashboard,
  ListChecks,
  MessageSquareWarning,
  Package,
  Settings,
  Star,
  Store,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";
import { RequireAuth } from "@/components/require-auth";
import { SideNav } from "@/components/side-nav";
import { Notice } from "@/components/ui";
import { useDemoState } from "@/lib/store";

export default function AdminLayout({ children }: { children: ReactNode }) {
  const s = useDemoState();
  const openDisputes = s.tickets.filter((t) => t.kind === "dispute" && ["open", "in_review"].includes(t.status)).length;
  const pendingListings = s.listings.filter((l) => l.status === "pending").length;
  const pendingPayouts = s.payouts.filter((p) => ["created", "in_review", "approved"].includes(p.status)).length;
  const openComplaints = s.tickets.filter((t) => t.kind === "complaint" && ["open", "in_review"].includes(t.status)).length;
  return (
    <RequireAuth role="admin">
      {() => (
        <div className="space-y-6">
          <Notice tone="warn">
            <b>Демо-админка.</b> Проверка роли выполняется в браузере и не является защитой. В production потребуется серверная авторизация и контроль ролей (Supabase Auth + RLS).
          </Notice>
          <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
            <aside className="lg:sticky lg:top-24 lg:self-start">
              <SideNav
                title="Администрирование"
                items={[
                  { href: "/admin", label: "Обзор", icon: LayoutDashboard },
                  { href: "/admin/users", label: "Пользователи", icon: Users },
                  { href: "/admin/sellers", label: "Продавцы", icon: Store },
                  { href: "/admin/listings", label: "Объявления и модерация", icon: Package, badge: pendingListings },
                  { href: "/admin/orders", label: "Заказы", icon: ListChecks },
                  { href: "/admin/disputes", label: "Споры", icon: Gavel, badge: openDisputes },
                  { href: "/admin/complaints", label: "Жалобы", icon: MessageSquareWarning, badge: openComplaints },
                  { href: "/admin/games", label: "Игры", icon: Gamepad2 },
                  { href: "/admin/commissions", label: "Комиссии", icon: Percent },
                  { href: "/admin/payouts", label: "Заявки на вывод", icon: Banknote, badge: pendingPayouts },
                  { href: "/admin/finance", label: "Финансовые операции", icon: Landmark },
                  { href: "/admin/audit", label: "Журнал действий", icon: History },
                  { href: "/admin/reviews", label: "Отзывы", icon: Star },
                  { href: "/admin/settings", label: "Настройки", icon: Settings },
                ]}
              />
            </aside>
            <div className="min-w-0">{children}</div>
          </div>
        </div>
      )}
    </RequireAuth>
  );
}
