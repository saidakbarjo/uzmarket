"use client";

import { OrdersList } from "@/components/orders-list";
import { RequireAuth } from "@/components/require-auth";
import { PageHeader } from "@/components/ui";
import { useDemoState } from "@/lib/store";

export default function SalesPage() {
  const s = useDemoState();
  return (
    <RequireAuth>
      {(user) => (
        <div>
          <PageHeader title="Мои продажи" subtitle="Заказы, где вы продавец." />
          <OrdersList
            userId={user.id}
            orders={s.orders.filter((o) => o.sellerId === user.id)}
            emptyTitle="Продаж пока нет"
            emptyText="Создайте объявление — и первые заказы появятся здесь."
            emptyAction={{ href: "/seller/new", label: "Создать объявление" }}
          />
        </div>
      )}
    </RequireAuth>
  );
}
