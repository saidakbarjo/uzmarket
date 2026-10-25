"use client";

import { useState, type FormEvent } from "react";
import { Field, Notice, PageHeader } from "@/components/ui";
import { PAYER_LABELS, calcCommission } from "@/lib/commission";
import { formatUZS } from "@/lib/money";
import { setGamePercent, setSellerPercent, updateCommissionSettings, useDemoState } from "@/lib/store";
import { toast } from "@/lib/toast";
import type { FeePayer } from "@/lib/types";
import type { FieldErrors } from "@/lib/validation";

function PercentCell({ value, placeholder, onSave, label }: { value: number | undefined; placeholder: string; onSave: (v: number | null) => void; label: string }) {
  const [text, setText] = useState(value === undefined ? "" : String(value));
  return (
    <div className="flex items-center gap-2">
      <input aria-label={label} className="input !w-24" inputMode="decimal" value={text} placeholder={placeholder} onChange={(e) => setText(e.target.value)} />
      <button
        type="button"
        className="btn-ghost !px-3 !py-1.5 !text-xs"
        onClick={() => {
          const t = text.trim().replace(",", ".");
          if (t === "") return onSave(null);
          const n = Number(t);
          if (!Number.isFinite(n)) return toast.error("Введите число");
          onSave(n);
        }}
      >
        Сохранить
      </button>
    </div>
  );
}

export default function AdminCommissionsPage() {
  const s = useDemoState();
  const c = s.commission;
  const [form, setForm] = useState({
    defaultPercent: String(c.defaultPercent),
    minFeeEnabled: c.minFeeEnabled,
    minFeeUzs: String(c.minFeeUzs),
    payer: c.payer as FeePayer,
    minOrderUzs: String(c.minOrderUzs),
    maxOrderUzs: String(c.maxOrderUzs),
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const num = (v: string) => (v.trim() === "" ? NaN : Number(v.replace(/\s/g, "").replace(",", ".")));

  function submit(e: FormEvent) {
    e.preventDefault();
    const r = updateCommissionSettings({
      defaultPercent: num(form.defaultPercent),
      minFeeEnabled: form.minFeeEnabled,
      minFeeUzs: num(form.minFeeUzs),
      payer: form.payer,
      minOrderUzs: num(form.minOrderUzs),
      maxOrderUzs: num(form.maxOrderUzs),
    });
    if (!r.ok) {
      setErrors(r.fieldErrors ?? {});
      return toast.error(r.fieldErrors ? "Проверьте поля формы" : r.error);
    }
    setErrors({});
    toast.success("Настройки комиссии сохранены. Старые заказы не изменились.");
  }

  // пример: 100 000 сум на первой включённой игре, без индивидуальной ставки
  const exampleGame = s.games.find((g) => g.enabled)?.slug ?? "";
  const live = { ...c, defaultPercent: num(form.defaultPercent), minFeeEnabled: form.minFeeEnabled, minFeeUzs: num(form.minFeeUzs) || 0, payer: form.payer };
  const example = Number.isFinite(live.defaultPercent) && live.defaultPercent >= 0 && live.defaultPercent <= 50 ? calcCommission(100_000, live, { gameSlug: exampleGame, sellerId: "-" }) : null;
  const sellers = s.profiles.filter((p) => p.isSeller);

  return (
    <div className="space-y-8">
      <PageHeader title="Комиссии" subtitle="Настройки доступны только администратору. Комиссия считается при создании заказа и фиксируется в нём." />
      <form onSubmit={submit} className="card grid gap-5 p-5 sm:grid-cols-2 lg:grid-cols-3" noValidate aria-label="Настройки комиссии">
        <Field label="Комиссия по умолчанию, %" htmlFor="def" error={errors.defaultPercent} hint="От 0 до 50. Можно дробные значения (2,5)."><input id="def" className="input" inputMode="decimal" value={form.defaultPercent} onChange={(e) => setForm({ ...form, defaultPercent: e.target.value })} /></Field>
        <Field label="Кто платит комиссию" htmlFor="payer" error={errors.payer}>
          <select id="payer" className="input" value={form.payer} onChange={(e) => setForm({ ...form, payer: e.target.value as FeePayer })}>
            {(Object.keys(PAYER_LABELS) as FeePayer[]).map((k) => <option key={k} value={k}>{PAYER_LABELS[k]}</option>)}
          </select>
        </Field>
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" className="h-4 w-4 accent-[var(--color-accent)]" checked={form.minFeeEnabled} onChange={(e) => setForm({ ...form, minFeeEnabled: e.target.checked })} /> Минимальная комиссия</label>
          <input aria-label="Минимальная комиссия, сум" className="input" inputMode="numeric" disabled={!form.minFeeEnabled} value={form.minFeeUzs} onChange={(e) => setForm({ ...form, minFeeUzs: e.target.value })} />
          {errors.minFeeUzs && <p role="alert" className="text-xs font-medium text-danger">{errors.minFeeUzs}</p>}
        </div>
        <Field label="Мин. сумма заказа, сум" htmlFor="minO" error={errors.minOrderUzs}><input id="minO" className="input" inputMode="numeric" value={form.minOrderUzs} onChange={(e) => setForm({ ...form, minOrderUzs: e.target.value })} /></Field>
        <Field label="Макс. сумма заказа, сум" htmlFor="maxO" error={errors.maxOrderUzs}><input id="maxO" className="input" inputMode="numeric" value={form.maxOrderUzs} onChange={(e) => setForm({ ...form, maxOrderUzs: e.target.value })} /></Field>
        <div className="flex items-end"><button type="submit" className="btn-primary">Сохранить настройки</button></div>
      </form>

      {example && (
        <Notice>
          Пример: заказ на <b>{formatUZS(100_000)}</b> → комиссия <b>{example.percent}%</b> = <b>{formatUZS(example.feeUzs)}</b>, платит: {PAYER_LABELS[example.payer]}; покупатель платит <b>{formatUZS(example.totalUzs)}</b>, продавец получает <b>{formatUZS(example.sellerNetUzs)}</b>.
        </Notice>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="card p-5" aria-labelledby="gp">
          <h2 id="gp" className="mb-1 font-semibold">Ставки по играм</h2>
          <p className="mb-4 text-xs text-muted">Пусто — действует ставка по умолчанию. Ставка продавца важнее ставки игры.</p>
          <ul className="divide-y divide-line">
            {s.games.map((g) => (
              <li key={g.slug} className="flex flex-wrap items-center justify-between gap-3 py-2.5 text-sm">
                <span>{g.name}</span>
                <PercentCell label={`Ставка для ${g.name}`} value={c.gamePercent[g.slug]} placeholder={String(c.defaultPercent)} onSave={(v) => { const r = setGamePercent(g.slug, v); { if (r.ok) toast.success("Ставка игры сохранена"); else toast.error(r.error); } }} />
              </li>
            ))}
          </ul>
        </section>
        <section className="card p-5" aria-labelledby="sp">
          <h2 id="sp" className="mb-1 font-semibold">Индивидуальные ставки продавцов</h2>
          <p className="mb-4 text-xs text-muted">Для отдельных продавцов (акции, партнёры).</p>
          <ul className="divide-y divide-line">
            {sellers.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5 text-sm">
                <span>{p.username}</span>
                <PercentCell label={`Ставка для ${p.username}`} value={c.sellerPercent[p.id]} placeholder="по умолч." onSave={(v) => { const r = setSellerPercent(p.id, v); { if (r.ok) toast.success("Ставка продавца сохранена"); else toast.error(r.error); } }} />
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
