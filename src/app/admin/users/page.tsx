"use client";

import { Ban, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { DataTable, type Column } from "@/components/data-table";
import { Badge, ConfirmButton, DemoBadge, PageHeader, formatDate } from "@/components/ui";
import { setUserBlocked, useCurrentUser, useDemoState } from "@/lib/store";
import { toast } from "@/lib/toast";
import type { Profile } from "@/lib/types";

export default function AdminUsersPage() {
  const s = useDemoState();
  const { user: me } = useCurrentUser();
  const [filter, setFilter] = useState<"all" | "blocked" | "admin" | "real">("all");

  const rows = s.profiles.filter((p) => {
    if (filter === "blocked") return p.blocked;
    if (filter === "admin") return p.role === "admin";
    if (filter === "real") return !p.isDemo;
    return true;
  });

  const columns: Column<Profile>[] = [
    { key: "name", header: "Пользователь", render: (p) => <span className="flex flex-wrap items-center gap-2 font-medium">{p.username}{p.isDemo && <DemoBadge />}{p.role === "admin" && <Badge tone="accent">Админ</Badge>}</span> },
    { key: "email", header: "E-mail", render: (p) => <span className="break-all text-muted">{p.email}</span> },
    { key: "created", header: "Регистрация", render: (p) => formatDate(p.createdAt) },
    { key: "status", header: "Статус", render: (p) => (p.blocked ? <Badge tone="danger">Заблокирован</Badge> : <Badge tone="ok">Активен</Badge>) },
    {
      key: "actions",
      header: "Действия",
      render: (p) =>
        p.id === me?.id || p.role === "admin" ? (
          <span className="text-xs text-muted">—</span>
        ) : p.blocked ? (
          <button
            type="button"
            className="btn-ghost !px-3 !py-1.5 !text-xs"
            onClick={() => {
              const r = setUserBlocked(p.id, false);
              if (r.ok) toast.success(`${p.username} разблокирован`);
              else toast.error(r.error);
            }}
          >
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden /> Разблокировать
          </button>
        ) : (
          <ConfirmButton
            label="Заблокировать"
            className="btn-danger !px-3 !py-1.5 !text-xs"
            icon={<Ban className="h-3.5 w-3.5" aria-hidden />}
            title={`Заблокировать ${p.username}?`}
            description="Пользователь не сможет входить, а его объявления пропадут из каталога. Блокировку можно снять."
            confirmLabel="Заблокировать"
            onConfirm={() => {
              const r = setUserBlocked(p.id, true);
              if (r.ok) toast.success(`${p.username} заблокирован`);
              else toast.error(r.error);
            }}
          />
        ),
    },
  ];

  return (
    <div>
      <PageHeader title="Пользователи" subtitle="Блокировка требует подтверждения." />
      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(p) => p.id}
        searchText={(p) => `${p.username} ${p.email}`}
        searchPlaceholder="Поиск по имени или e-mail"
        toolbar={
          <select className="input !w-auto" value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} aria-label="Фильтр пользователей">
            <option value="all">Все</option>
            <option value="real">Только зарегистрированные</option>
            <option value="admin">Администраторы</option>
            <option value="blocked">Заблокированные</option>
          </select>
        }
      />
    </div>
  );
}
