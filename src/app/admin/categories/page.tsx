"use client";

import { DataTable, type Column } from "@/components/data-table";
import { Badge, CategoryIcon, ConfirmButton, PageHeader } from "@/components/ui";
import { categories } from "@/lib/data/seed";
import { setCategoryEnabled, useDemoState } from "@/lib/store";
import { toast } from "@/lib/toast";
import type { Category } from "@/lib/types";

export default function AdminCategoriesPage() {
  const s = useDemoState();

  const columns: Column<Category>[] = [
    { key: "name", header: "Категория", render: (c) => <span className="flex items-center gap-2 font-medium"><CategoryIcon slug={c.slug} className="h-4 w-4 text-accent" />{c.name}</span> },
    { key: "uz", header: "На узбекском", render: (c) => <span className="text-muted">{c.nameUz}</span> },
    { key: "count", header: "Объявлений", render: (c) => s.listings.filter((l) => l.categorySlug === c.slug).length },
    { key: "state", header: "Статус", render: (c) => (s.disabledCategories.includes(c.slug) ? <Badge tone="warn">Отключена</Badge> : <Badge tone="ok">Включена</Badge>) },
    {
      key: "actions",
      header: "Действия",
      render: (c) =>
        s.disabledCategories.includes(c.slug) ? (
          <button
            type="button"
            className="btn-ghost !px-3 !py-1.5 !text-xs"
            onClick={() => {
              const r = setCategoryEnabled(c.slug, true);
              if (r.ok) toast.success("Категория включена");
              else toast.error(r.error);
            }}
          >
            Включить
          </button>
        ) : (
          <ConfirmButton
            label="Отключить"
            className="btn-danger !px-3 !py-1.5 !text-xs"
            title={`Отключить «${c.name}»?`}
            description="Категория пропадёт из каталога и формы создания объявлений. Существующие объявления сохранятся."
            confirmLabel="Отключить"
            onConfirm={() => {
              const r = setCategoryEnabled(c.slug, false);
              if (r.ok) toast.success("Категория отключена");
              else toast.error(r.error);
            }}
          />
        ),
    },
  ];

  return (
    <div>
      <PageHeader title="Категории" subtitle="Включение и отключение категорий каталога." />
      <DataTable rows={categories} columns={columns} rowKey={(c) => c.slug} searchText={(c) => `${c.name} ${c.nameUz}`} searchPlaceholder="Поиск категории" />
    </div>
  );
}
