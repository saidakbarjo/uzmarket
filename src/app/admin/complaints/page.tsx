"use client";

import { AdminTickets } from "@/components/admin-tickets";
import { PageHeader } from "@/components/ui";

export default function AdminComplaintsPage() {
  return (
    <div className="space-y-4">
      <PageHeader title="Жалобы и обращения" subtitle="Жалобы на объявления и пользователей, вопросы в поддержку." />
      <AdminTickets kinds={["complaint", "support"]} />
    </div>
  );
}
