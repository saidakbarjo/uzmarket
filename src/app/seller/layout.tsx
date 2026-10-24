"use client";

import { BarChart3, ListChecks, PackagePlus, Store } from "lucide-react";
import type { ReactNode } from "react";
import { RequireAuth } from "@/components/require-auth";
import { SideNav } from "@/components/side-nav";

export default function SellerLayout({ children }: { children: ReactNode }) {
  return (
    <RequireAuth>
      {() => (
        <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <SideNav
              title="Продавец"
              items={[
                { href: "/seller", label: "Мои объявления", icon: Store },
                { href: "/seller/new", label: "Новое объявление", icon: PackagePlus },
                { href: "/seller/orders", label: "Заказы", icon: ListChecks },
                { href: "/seller/stats", label: "Статистика", icon: BarChart3 },
              ]}
            />
          </aside>
          <div className="min-w-0">{children}</div>
        </div>
      )}
    </RequireAuth>
  );
}
