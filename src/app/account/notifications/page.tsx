"use client";

import Link from "next/link";
import { Bell, CheckCheck } from "lucide-react";
import { RequireAuth } from "@/components/require-auth";
import { EmptyState, PageHeader, formatDate } from "@/components/ui";
import { markNotificationsRead, useDemoState } from "@/lib/store";

export default function NotificationsPage() {
  const s = useDemoState();
  return (
    <RequireAuth>
      {(user) => {
        const items = s.notifications.filter((n) => n.userId === user.id);
        const unread = items.filter((n) => !n.read).length;
        return (
          <div>
            <PageHeader
              title="Уведомления"
              subtitle={unread ? `Непрочитанных: ${unread}` : "Все прочитано"}
              actions={
                <button type="button" className="btn-ghost" disabled={!unread} onClick={() => markNotificationsRead()}>
                  <CheckCheck className="h-4 w-4" aria-hidden /> Отметить прочитанными
                </button>
              }
            />
            {items.length === 0 ? (
              <EmptyState icon={<Bell className="h-7 w-7" aria-hidden />} title="Уведомлений нет" text="Здесь появятся события по вашим заказам и обращениям." />
            ) : (
              <ul className="space-y-2">
                {items.map((n) => {
                  const body = (
                    <div className={`card flex items-start gap-3 p-4 ${n.read ? "opacity-70" : "border-accent/40"}`}>
                      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read ? "bg-line" : "bg-accent"}`} aria-hidden />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm">{n.text}</p>
                        <p className="mt-0.5 text-xs text-muted">{formatDate(n.at, true)}</p>
                      </div>
                    </div>
                  );
                  return <li key={n.id}>{n.href ? <Link href={n.href}>{body}</Link> : body}</li>;
                })}
              </ul>
            )}
          </div>
        );
      }}
    </RequireAuth>
  );
}
