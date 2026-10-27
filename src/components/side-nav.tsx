"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
}

export function SideNav({ items, title }: { items: NavItem[]; title: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label={title} className="card p-2">
      <p className="px-3 pb-2 pt-2 text-xs font-semibold text-muted">{title}</p>
      <ul className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
        {items.map((it) => {
          const active = it.href === items[0].href ? pathname === it.href : pathname === it.href || pathname.startsWith(it.href + "/");
          return (
            <li key={it.href} className="shrink-0 lg:shrink">
              <Link
                href={it.href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-2.5 whitespace-nowrap rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  active ? "bg-accent/15 text-ink" : "text-muted hover:bg-panel-2 hover:text-ink"
                }`}
              >
                <it.icon className={`h-4 w-4 ${active ? "text-accent" : ""}`} aria-hidden />
                {it.label}
                {!!it.badge && <span className="ml-auto rounded-full bg-accent px-1.5 text-[10px] font-bold text-white">{it.badge}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
