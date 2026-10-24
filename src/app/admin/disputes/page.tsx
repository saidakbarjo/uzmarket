"use client";

import { AdminTickets } from "@/components/admin-tickets";
import { Notice, PageHeader } from "@/components/ui";

export default function AdminDisputesPage() {
  return (
    <div className="space-y-4">
      <PageHeader title="Споры" subtitle="Споры по заказам. Решение о возврате принимается после проверки доказательств." />
      <Notice tone="warn">В демо-режиме возврат — тестовая операция на странице заказа, реальные деньги не двигаются.</Notice>
      <AdminTickets kinds={["dispute"]} />
    </div>
  );
}
