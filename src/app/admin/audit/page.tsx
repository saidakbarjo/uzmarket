"use client";

import { DataTable, type Column } from "@/components/data-table";
import { PageHeader, formatDate } from "@/components/ui";
import { useDemoState } from "@/lib/store";
import type { AuditEntry } from "@/lib/types";

export default function AdminAuditPage() {
  const s = useDemoState();
  const name = (id: string) => (id === "system" ? "Система" : (s.profiles.find((p) => p.id === id)?.username ?? id));
  const columns: Column<AuditEntry>[] = [
    { key: "at", header: "Время", render: (e) => formatDate(e.at, true) },
    { key: "actor", header: "Кто", render: (e) => name(e.actorId) },
    { key: "action", header: "Действие", render: (e) => <span className="font-mono text-xs">{e.action}</span> },
    { key: "entity", header: "Объект", render: (e) => <span className="text-xs text-muted">{e.entity} · {e.entityId}</span> },
    { key: "detail", header: "Подробности", render: (e) => <span className="text-sm">{e.detail}</span> },
  ];
  return (
    <div className="space-y-4">
      <PageHeader title="Журнал действий" subtitle="Заказы, деньги, споры, выплаты, настройки. Записи не редактируются." />
      <DataTable rows={[...s.audit].sort((a, b) => b.at.localeCompare(a.at))} columns={columns} rowKey={(e) => e.id} searchText={(e) => `${e.action} ${e.entity} ${e.entityId} ${e.detail} ${name(e.actorId)}`} searchPlaceholder="Действие, объект, пользователь" pageSize={12} />
    </div>
  );
}
