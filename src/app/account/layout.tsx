"use client";

import { DEMO_FINANCE } from "@/lib/flags";
import { Bell, Heart, Wallet, ListChecks, MessageSquareText, Settings, ShoppingBag, Store, UserRound } from "lucide-react";
import type { ReactNode } from "react";
import { RequireAuth } from "@/components/require-auth";
import { SideNav } from "@/components/side-nav";
import { useDemoState } from "@/lib/store";

export default function AccountLayout({ children }: { children: ReactNode }) {
  const s = useDemoState();
  return (
    <RequireAuth>
      {(user) => {
        const unread = s.notifications.filter((n) => n.userId === user.id && !n.read).length;
        return (
          <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
            <aside className="lg:sticky lg:top-24 lg:self-start">
              <SideNav
                title="Кабинет"
                items={[
                  { href: "/account", label: "Мой профиль", icon: UserRound },
                  { href: "/account/orders", label: "Мои заказы", icon: ListChecks },
                  { href: "/account/purchases", label: "Мои покупки", icon: ShoppingBag },
                  { href: "/account/sales", label: "Мои продажи", icon: Store },
                  ...(DEMO_FINANCE ? [{ href: "/account/finance", label: "Финансы", icon: Wallet }] : []),
                  { href: "/account/favorites", label: "Избранное", icon: Heart },
                  { href: "/account/reviews", label: "Отзывы", icon: MessageSquareText },
                  { href: "/account/notifications", label: "Уведомления", icon: Bell, badge: unread },
                  { href: "/account/settings", label: "Настройки", icon: Settings },
                ]}
              />
            </aside>
            <div className="min-w-0">{children}</div>
          </div>
        );
      }}
    </RequireAuth>
  );
}
