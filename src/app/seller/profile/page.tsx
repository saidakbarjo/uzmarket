"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Field, PageHeader } from "@/components/ui";
import { PAYOUT_METHOD_LABELS } from "@/lib/payouts";
import { updateSellerProfile, useCurrentUser, useDemoState } from "@/lib/store";
import { toast } from "@/lib/toast";
import type { PayoutMethod, SellerProfile } from "@/lib/types";
import type { FieldErrors } from "@/lib/validation";

function Form({ sp }: { sp: SellerProfile }) {
  const [form, setForm] = useState({ shopName: sp.shopName, about: sp.about, payoutMethod: sp.payoutMethod });
  const [errors, setErrors] = useState<FieldErrors>({});
  function submit(e: FormEvent) {
    e.preventDefault();
    const r = updateSellerProfile(form);
    if (r.ok) {
      setErrors({});
      toast.success("Профиль продавца сохранён");
    } else {
      setErrors(r.fieldErrors ?? {});
      toast.error(r.fieldErrors ? "Проверьте поля формы" : r.error);
    }
  }
  return (
    <form onSubmit={submit} className="card max-w-2xl space-y-5 p-5 sm:p-6" noValidate>
      <Field label="Название магазина" htmlFor="shop" error={errors.shopName}><input id="shop" className="input" value={form.shopName} onChange={(e) => setForm({ ...form, shopName: e.target.value })} maxLength={40} /></Field>
      <Field label="О магазине" htmlFor="about" error={errors.about}><textarea id="about" rows={4} className="input" value={form.about} onChange={(e) => setForm({ ...form, about: e.target.value })} maxLength={500} /></Field>
      <Field label="Способ вывода (тест)" htmlFor="pm" error={errors.payoutMethod}>
        <select id="pm" className="input" value={form.payoutMethod} onChange={(e) => setForm({ ...form, payoutMethod: e.target.value as PayoutMethod })}>
          {(Object.keys(PAYOUT_METHOD_LABELS) as PayoutMethod[]).map((m) => <option key={m} value={m}>{PAYOUT_METHOD_LABELS[m]}</option>)}
        </select>
      </Field>
      <button type="submit" className="btn-primary">Сохранить</button>
    </form>
  );
}

export default function SellerProfilePage() {
  const s = useDemoState();
  const { user } = useCurrentUser();
  const sp = user ? s.sellerProfiles.find((x) => x.userId === user.id) : undefined;
  if (!user || !sp) return null;
  return (
    <div className="space-y-4">
      <PageHeader title="Профиль продавца" actions={<Link href={`/shop?id=${user.id}`} className="btn-ghost">Как видят покупатели</Link>} />
      <Form key={sp.shopName + sp.about} sp={sp} />
    </div>
  );
}
