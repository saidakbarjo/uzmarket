"use client";

import { DEMO_FINANCE } from "@/lib/flags";
import { BarChart3, ListChecks, MessageSquareReply, PackagePlus, Settings, Store, Wallet } from "lucide-react";
import type { ReactNode } from "react";
import { BecomeSeller } from "@/components/become-seller";
import { RequireAuth } from "@/components/require-auth";
import { SideNav } from "@/components/side-nav";

export default function SellerLayout({ children }: { children: ReactNode }) {
  return (
    <RequireAuth>
      {(user) =>
        !user.isSeller ? (
          <BecomeSeller />
        ) : (
          <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
            <aside className="lg:sticky lg:top-24 lg:self-start">
              <SideNav
                title="Продавец"
                items={[
                  { href: "/seller", label: "Мои объявления", icon: Store },
                  { href: "/seller/new", label: "Продать товар", icon: PackagePlus },
                  { href: "/seller/orders", label: "Заказы", icon: ListChecks },
                  ...(DEMO_FINANCE ? [{ href: "/seller/finance", label: "Финансы и выплаты", icon: Wallet }] : []),
                  { href: "/seller/stats", label: "Статистика", icon: BarChart3 },
                  { href: "/seller/reviews", label: "Отзывы", icon: MessageSquareReply },
                  { href: "/seller/profile", label: "Профиль продавца", icon: Settings },
                ]}
              />
            </aside>
            <div className="min-w-0">{children}</div>
          </div>
        )
      }
    </RequireAuth>
  );
}
