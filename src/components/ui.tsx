"use client";

import Link from "next/link";
import { AlertTriangle, CheckCircle2, FlaskConical, Info, Loader2, Package, Star, X } from "lucide-react";
import { useEffect, useId, useState, type ReactNode } from "react";
import { STATUS_LABELS } from "@/lib/orders-domain";
import { useDemoState } from "@/lib/store";
import { dismiss, useToasts } from "@/lib/toast";
import { PAYOUT_STATUS_LABELS } from "@/lib/payouts";
import { ProductArt } from "@/components/product-art";
import type { Game, OrderStatus, PayoutStatus, ProductType, Profile, TicketStatus } from "@/lib/types";

/* ───── игры ───── */
export function useGame(slug: string): Game | undefined {
  return useDemoState().games.find((g) => g.slug === slug);
}

/** Квадратный значок игры: аббревиатура на цветном фоне (без внешних картинок). */
export function GameIcon({ slug, className = "h-8 w-8" }: { slug: string; className?: string }) {
  const g = useGame(slug);
  const h = g?.hue ?? 250;
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center rounded-lg font-display text-[10px] font-bold tracking-tight text-white ${className}`}
      style={{ background: `linear-gradient(135deg, hsl(${h} 65% 42%), hsl(${(h + 40) % 360} 60% 26%))` }}
    >
      {g?.abbr ?? "?"}
    </span>
  );
}

/** Цвета обложки по оттенку игры: у каждой игры свой цвет, орнамент общий. */
export function coverStyle(h: number) {
  return {
    background: `radial-gradient(90% 120% at 100% 0%, hsl(${(h + 30) % 360} 70% 46% / 0.55), transparent 62%), linear-gradient(150deg, hsl(${h} 55% 24%), hsl(${(h + 20) % 360} 50% 12%))`,
  };
}

/** Изображение товара: загруженная картинка либо локальная обложка с орнаментом и логотипом-аббревиатурой игры. */
export function ListingImage({
  gameSlug,
  images,
  index = 0,
  hue,
  className = "",
  label,
  type,
  seed,
  centerArt = false,
}: {
  gameSlug: string;
  images?: string[];
  index?: number;
  hue?: number;
  className?: string;
  label?: string;
  type?: ProductType;
  seed?: string;
  centerArt?: boolean;
}) {
  const g = useGame(gameSlug);
  const src = images?.[index];
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={label ?? "Изображение товара"} className={`object-cover ${className}`} loading="lazy" />
    );
  }
  const h = hue ?? g?.hue ?? 250;
  return (
    <div
      role="img"
      aria-label={label ?? "Изображение товара (заглушка)"}
      className={`relative isolate flex items-end overflow-hidden ${className}`}
      style={coverStyle(h)}
    >
      <div className="ornament absolute inset-0 opacity-[0.09]" />
      <span aria-hidden className="absolute -right-2 -top-3 font-display text-[5.5rem] font-black leading-none tracking-tighter text-white/[0.14] sm:text-[6.5rem]">{g?.abbr ?? ""}</span>
      {type && <ProductArt type={type} hue={h} seed={seed} className={`absolute top-1/2 aspect-square h-[70%] sm:h-[84%] drop-shadow-[0_8px_14px_rgba(0,0,0,0.35)] ${centerArt ? "left-1/2 -translate-x-1/2 -translate-y-[48%]" : "right-[2%] -translate-y-[40%] sm:right-[5%] sm:-translate-y-[48%]"}`} />}
      <span className="relative m-2 max-w-[48%] truncate rounded-md bg-black/35 px-1.5 py-0.5 font-display text-[10px] font-semibold text-white/90 backdrop-blur-sm sm:m-3 sm:max-w-[60%] sm:px-2 sm:py-1 sm:text-[11px]">{g?.name ?? <Package className="h-4 w-4" />}</span>
    </div>
  );
}

/** Аватар пользователя: "hue:NNN" — цветной круг с инициалом, иначе загруженное изображение. */
export function Avatar({ user, className = "h-9 w-9" }: { user: Pick<Profile, "username" | "avatar">; className?: string }) {
  const av = user.avatar;
  if (av && av.startsWith("data:image/")) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={av} alt="" className={`shrink-0 rounded-full object-cover ${className}`} />;
  }
  const h = av?.startsWith("hue:") ? Number(av.slice(4)) : 250;
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${className}`}
      style={{ background: `linear-gradient(135deg, hsl(${h} 65% 48%), hsl(${(h + 60) % 360} 60% 30%))` }}
    >
      {user.username.slice(0, 1).toUpperCase()}
    </span>
  );
}

/* ───── бейджи ───── */
export function Badge({
  children,
  tone = "neutral",
  className = "",
}: {
  children: ReactNode;
  tone?: "neutral" | "ok" | "warn" | "danger" | "accent";
  className?: string;
}) {
  const tones = {
    neutral: "border-line bg-panel-2 text-muted",
    ok: "border-ok/30 bg-ok/10 text-ok",
    warn: "border-warn/30 bg-warn/10 text-warn",
    danger: "border-danger/30 bg-danger/10 text-danger",
    accent: "border-accent/40 bg-accent/10 text-accent",
  };
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium ${tones[tone]} ${className}`}>
      {children}
    </span>
  );
}

export function DemoBadge({ label = "ТЕСТ" }: { label?: string }) {
  return (
    <Badge tone="warn" >
      <FlaskConical className="h-3 w-3" aria-hidden /> {label}
    </Badge>
  );
}

const STATUS_TONE: Record<OrderStatus, "neutral" | "ok" | "warn" | "danger" | "accent"> = {
  pending_payment: "warn",
  paid: "accent",
  in_progress: "accent",
  delivered: "accent",
  completed: "ok",
  disputed: "danger",
  refund_review: "warn",
  cancelled: "neutral",
  refunded: "neutral",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{STATUS_LABELS[status]}</Badge>;
}

const TICKET_LABELS: Record<TicketStatus, string> = {
  open: "Открыто",
  in_review: "На рассмотрении",
  need_info: "Нужны сведения",
  resolved: "Решено",
  rejected: "Отклонено",
};

export function TicketStatusBadge({ status }: { status: TicketStatus }) {
  const tone = status === "resolved" ? "ok" : status === "rejected" ? "danger" : status === "in_review" ? "accent" : "warn";
  return <Badge tone={tone}>{TICKET_LABELS[status]}</Badge>;
}

export const ticketStatusLabels = TICKET_LABELS;

const PAYOUT_TONE: Record<PayoutStatus, "neutral" | "ok" | "warn" | "danger" | "accent"> = { created: "warn", in_review: "accent", approved: "accent", paid: "ok", rejected: "danger" };
export function PayoutStatusBadge({ status }: { status: PayoutStatus }) {
  return <Badge tone={PAYOUT_TONE[status]}>{PAYOUT_STATUS_LABELS[status]}</Badge>;
}

/* ───── рейтинг ───── */
export function Stars({ value, size = "h-4 w-4" }: { value: number; size?: string }) {
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={`Рейтинг ${value} из 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={`${size} ${i <= Math.round(value) ? "fill-warn text-warn" : "text-line"}`} aria-hidden />
      ))}
    </span>
  );
}

/* ───── формы ───── */
export function Field({
  label,
  error,
  hint,
  children,
  htmlFor,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-ink">
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-muted">{hint}</p>}
      {error && (
        <p role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return <Loader2 className={`animate-spin ${className}`} aria-label="Загрузка" />;
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-panel-2 ${className}`} aria-hidden />;
}

/* ───── пустые состояния и ошибки ───── */
export function EmptyState({
  icon,
  title,
  text,
  action,
}: {
  icon?: ReactNode;
  title: string;
  text?: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="card flex flex-col items-center gap-3 px-6 py-12 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-panel-2 text-accent">
        {icon ?? <Package className="h-7 w-7" aria-hidden />}
      </div>
      <h3 className="font-display text-lg font-semibold">{title}</h3>
      {text && <p className="max-w-md text-sm text-muted">{text}</p>}
      {action && (
        <Link href={action.href} className="btn-primary mt-2">
          {action.label}
        </Link>
      )}
    </div>
  );
}

export function Notice({
  tone = "info",
  children,
  className = "",
}: {
  tone?: "info" | "warn" | "danger" | "ok";
  children: ReactNode;
  className?: string;
}) {
  const styles = {
    info: "border-accent-2/30 bg-accent-2/10 text-ink",
    warn: "border-warn/30 bg-warn/10 text-ink",
    danger: "border-danger/30 bg-danger/10 text-ink",
    ok: "border-ok/30 bg-ok/10 text-ink",
  } as const;
  const Icon = tone === "ok" ? CheckCircle2 : tone === "info" ? Info : AlertTriangle;
  const color = { info: "text-accent-2", warn: "text-warn", danger: "text-danger", ok: "text-ok" }[tone];
  return (
    <div role={tone === "danger" ? "alert" : "note"} className={`flex gap-3 rounded-xl border p-3.5 text-sm ${styles[tone]} ${className}`}>
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${color}`} aria-hidden />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/* ───── тосты ───── */
export function Toaster() {
  const items = useToasts();
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4" aria-live="polite">
      {items.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex w-full max-w-md animate-pop items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-2xl backdrop-blur ${
            t.kind === "success"
              ? "border-ok/40 bg-panel/95"
              : t.kind === "error"
                ? "border-danger/40 bg-panel/95"
                : "border-accent/40 bg-panel/95"
          }`}
        >
          {t.kind === "success" ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-ok" aria-hidden />
          ) : t.kind === "error" ? (
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden />
          ) : (
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
          )}
          <p className="min-w-0 flex-1">{t.text}</p>
          <button onClick={() => dismiss(t.id)} aria-label="Закрыть уведомление" className="text-muted hover:text-ink">
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}

/* ───── подтверждение опасных действий ───── */
export function ConfirmButton({
  label,
  title,
  description,
  confirmLabel = "Подтвердить",
  onConfirm,
  className = "btn-danger",
  disabled,
  icon,
}: {
  label: string;
  title: string;
  description: string;
  confirmLabel?: string;
  onConfirm: () => void;
  className?: string;
  disabled?: boolean;
  icon?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button type="button" className={className} disabled={disabled} onClick={() => setOpen(true)}>
        {icon}
        {label}
      </button>
      {open && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4" onClick={() => setOpen(false)}>
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={`${id}-t`}
            aria-describedby={`${id}-d`}
            className="card w-full max-w-md animate-pop p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-danger/10 text-danger">
              <AlertTriangle className="h-5 w-5" aria-hidden />
            </div>
            <h2 id={`${id}-t`} className="font-display text-lg font-semibold">
              {title}
            </h2>
            <p id={`${id}-d`} className="mt-1.5 text-sm text-muted">
              {description}
            </p>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button type="button" className="btn-ghost" onClick={() => setOpen(false)} autoFocus>
                Отмена
              </button>
              <button
                type="button"
                className="btn bg-danger text-white hover:brightness-110"
                onClick={() => {
                  setOpen(false);
                  onConfirm();
                }}
              >
                {confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function formatDate(iso: string, withTime = false): string {
  const d = new Date(iso);
  return d.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
    timeZone: "Asia/Tashkent",
  });
}
