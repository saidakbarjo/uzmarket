"use client";

import { OrdersList } from "@/components/orders-list";
import { RequireAuth } from "@/components/require-auth";
import { PageHeader } from "@/components/ui";
import { useDemoState } from "@/lib/store";

export default function SellerOrdersPage() {
  const s = useDemoState();
  return (
    <RequireAuth>
      {(user) => (
        <div>
          <PageHeader title="Заказы по моим объявлениям" subtitle="Откройте заказ, чтобы приступить к выполнению и отметить выдачу." />
          <OrdersList
            userId={user.id}
            orders={s.orders.filter((o) => o.sellerId === user.id)}
            emptyTitle="Заказов пока нет"
            emptyText="Как только кто-то оформит заказ по вашему объявлению, он появится здесь."
            emptyAction={{ href: "/seller/new", label: "Создать объявление" }}
          />
        </div>
      )}
    </RequireAuth>
  );
}
