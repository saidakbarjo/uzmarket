"use client";

import { Star } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Field } from "@/components/ui";
import { addReview } from "@/lib/store";
import { toast } from "@/lib/toast";
import type { FieldErrors } from "@/lib/validation";

export function ReviewForm({ orderId, onDone }: { orderId: string; onDone?: () => void }) {
  const [rating, setRating] = useState(0);
  const [text, setText] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const r = addReview(orderId, { rating, text });
    if (r.ok) {
      toast.success("Спасибо! Отзыв опубликован.");
      onDone?.();
    } else {
      setErrors(r.fieldErrors ?? {});
      if (!r.fieldErrors) toast.error(r.error);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium">Оценка</legend>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((i) => (
            <button
              key={i}
              type="button"
              onClick={() => setRating(i)}
              aria-label={`${i} из 5`}
              aria-pressed={rating === i}
              className="rounded-lg p-1 transition hover:scale-110"
            >
              <Star className={`h-7 w-7 ${i <= rating ? "fill-warn text-warn" : "text-line"}`} />
            </button>
          ))}
        </div>
        {errors.rating && <p role="alert" className="mt-1 text-xs font-medium text-danger">{errors.rating}</p>}
      </fieldset>
      <Field label="Текст отзыва" htmlFor={`review-${orderId}`} error={errors.text}>
        <textarea id={`review-${orderId}`} rows={3} className="input" value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} />
      </Field>
      <button type="submit" className="btn-primary">Опубликовать отзыв</button>
    </form>
  );
}
