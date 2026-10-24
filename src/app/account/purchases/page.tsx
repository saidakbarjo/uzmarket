"use client";

import { OrdersList } from "@/components/orders-list";
import { RequireAuth } from "@/components/require-auth";
import { PageHeader } from "@/components/ui";
import { useDemoState } from "@/lib/store";

export default function PurchasesPage() {
  const s = useDemoState();
  return (
    <RequireAuth>
      {(user) => (
        <div>
          <PageHeader title="Мои покупки" subtitle="Заказы, где вы покупатель." />
          <OrdersList
            userId={user.id}
            orders={s.orders.filter((o) => o.buyerId === user.id)}
            emptyTitle="Вы пока ничего не покупали"
            emptyText="Найдите нужный товар в каталоге и оформите первый заказ."
            emptyAction={{ href: "/catalog", label: "Перейти в каталог" }}
          />
        </div>
      )}
    </RequireAuth>
  );
}
