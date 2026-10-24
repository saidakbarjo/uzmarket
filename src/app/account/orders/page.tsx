"use client";

import { OrdersList } from "@/components/orders-list";
import { RequireAuth } from "@/components/require-auth";
import { PageHeader } from "@/components/ui";
import { useDemoState } from "@/lib/store";

export default function MyOrdersPage() {
  const s = useDemoState();
  return (
    <RequireAuth>
      {(user) => (
        <div>
          <PageHeader title="Мои заказы" subtitle="Все ваши сделки: и покупки, и продажи." />
          <OrdersList
            userId={user.id}
            orders={s.orders.filter((o) => o.buyerId === user.id || o.sellerId === user.id)}
            emptyTitle="Заказов пока нет"
            emptyText="Когда вы купите товар или получите заказ как продавец, он появится здесь."
            emptyAction={{ href: "/catalog", label: "Перейти в каталог" }}
          />
        </div>
      )}
    </RequireAuth>
  );
}
