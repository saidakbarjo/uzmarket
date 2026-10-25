"use client";

import { Plus } from "lucide-react";
import { useState, type FormEvent } from "react";
import { DataTable, type Column } from "@/components/data-table";
import { Badge, ConfirmButton, Field, GameIcon, Notice, PageHeader } from "@/components/ui";
import { addGame, deleteGame, setGameEnabled, updateGame, useDemoState } from "@/lib/store";
import { toast } from "@/lib/toast";
import type { Game } from "@/lib/types";
import type { FieldErrors } from "@/lib/validation";

export default function AdminGamesPage() {
  const s = useDemoState();
  const [form, setForm] = useState({ name: "", nameUz: "", nameEn: "", description: "", hue: 200 });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [editing, setEditing] = useState<string | null>(null);

  function submit(e: FormEvent) {
    e.preventDefault();
    const r = editing ? updateGame(editing, form) : addGame(form);
    if (!r.ok) {
      setErrors(r.fieldErrors ?? {});
      return toast.error(r.fieldErrors ? "Проверьте поля формы" : r.error);
    }
    setErrors({});
    toast.success(editing ? "Игра обновлена" : "Игра добавлена");
    setForm({ name: "", nameUz: "", nameEn: "", description: "", hue: 200 });
    setEditing(null);
  }

  const columns: Column<Game>[] = [
    { key: "name", header: "Игра", render: (g) => <span className="flex items-center gap-2 font-medium"><GameIcon slug={g.slug} className="h-7 w-7" />{g.name}</span> },
    { key: "uz", header: "UZ / EN", render: (g) => <span className="text-muted">{g.nameUz} / {g.nameEn}</span> },
    { key: "count", header: "Объявлений", render: (g) => s.listings.filter((l) => l.gameSlug === g.slug).length },
    { key: "state", header: "Статус", render: (g) => (g.enabled ? <Badge tone="ok">Включена</Badge> : <Badge tone="warn">Отключена</Badge>) },
    {
      key: "actions",
      header: "Действия",
      render: (g) => (
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-ghost !px-3 !py-1.5 !text-xs" onClick={() => { setEditing(g.slug); setForm({ name: g.name, nameUz: g.nameUz, nameEn: g.nameEn, description: g.description, hue: g.hue }); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Изменить</button>
          {g.enabled ? (
            <ConfirmButton
              label="Отключить"
              className="btn-danger !px-3 !py-1.5 !text-xs"
              title={`Отключить «${g.name}»?`}
              description="Игра пропадёт из каталога и формы продажи. Существующие объявления и заказы сохранятся."
              confirmLabel="Отключить"
              onConfirm={() => { const r = setGameEnabled(g.slug, false); { if (r.ok) toast.success("Игра отключена"); else toast.error(r.error); } }}
            />
          ) : (
            <button type="button" className="btn-ghost !px-3 !py-1.5 !text-xs" onClick={() => { const r = setGameEnabled(g.slug, true); { if (r.ok) toast.success("Игра включена"); else toast.error(r.error); } }}>Включить</button>
          )}
          <ConfirmButton
            label="Удалить"
            className="btn-danger !px-3 !py-1.5 !text-xs"
            title={`Удалить «${g.name}»?`}
            description="Удаление возможно только если нет объявлений и заказов по этой игре."
            confirmLabel="Удалить"
            onConfirm={() => { const r = deleteGame(g.slug); { if (r.ok) toast.success("Игра удалена"); else toast.error(r.error); } }}
          />
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Игры" subtitle="Каталог ограничен играми из этого списка. Другие категории добавить нельзя, пока их не создал администратор." />
      <form onSubmit={submit} className="card grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4" noValidate aria-label="Добавить игру">
        <Field label="Название (RU)" htmlFor="gname" error={errors.name}><input id="gname" className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={40} /></Field>
        <Field label="Название (UZ)" htmlFor="gnameuz" error={errors.nameUz}><input id="gnameuz" className="input" value={form.nameUz} onChange={(e) => setForm({ ...form, nameUz: e.target.value })} maxLength={40} /></Field>
        <Field label="Название (EN)" htmlFor="gnameen" error={errors.nameEn}><input id="gnameen" className="input" value={form.nameEn} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} maxLength={40} /></Field>
        <Field label="Цвет обложки" htmlFor="ghue"><input id="ghue" type="range" min={0} max={359} className="w-full" value={form.hue} onChange={(e) => setForm({ ...form, hue: Number(e.target.value) })} /></Field>
        <div className="sm:col-span-2 lg:col-span-3">
          <Field label="Описание" htmlFor="gdesc" error={errors.description}><input id="gdesc" className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={160} /></Field>
        </div>
        <div className="flex items-end gap-2">
          <button type="submit" className="btn-primary"><Plus className="h-4 w-4" aria-hidden /> {editing ? "Сохранить" : "Добавить игру"}</button>
          {editing && <button type="button" className="btn-ghost" onClick={() => { setEditing(null); setForm({ name: "", nameUz: "", nameEn: "", description: "", hue: 200 }); }}>Отмена</button>}
        </div>
      </form>
      <Notice>Изменение названия не затрагивает существующие заказы: в заказе хранится slug игры.</Notice>
      <DataTable rows={[...s.games].sort((a, b) => a.sortOrder - b.sortOrder)} columns={columns} rowKey={(g) => g.slug} searchText={(g) => `${g.name} ${g.nameUz} ${g.nameEn}`} searchPlaceholder="Поиск игры" />
    </div>
  );
}
