import { useId } from "react";
import type { ProductType } from "@/lib/types";

/**
 * Оригинальные иллюстрации для обложек без фотографий.
 * Это обобщённые образы типа товара (монеты, ящик, карта-ключ, гарнитура), а не логотипы и персонажи игр.
 * Настоящие фото к объявлению продавец загружает сам.
 */

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export function ProductArt({ type, hue, seed = "", className = "" }: { type: ProductType; hue: number; seed?: string; className?: string }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const v = hash(seed) % 3;
  const light = `hsl(${hue} 88% 72%)`;
  const mid = `hsl(${hue} 78% 55%)`;
  const dark = `hsl(${hue} 70% 34%)`;
  const deep = `hsl(${hue} 65% 22%)`;

  return (
    <svg viewBox="0 0 120 120" className={className} aria-hidden focusable="false">
      <defs>
        <radialGradient id={`g${id}`} cx="50%" cy="52%" r="50%">
          <stop offset="0" stopColor={`hsl(${hue} 95% 62%)`} stopOpacity="0.5" />
          <stop offset="1" stopColor={`hsl(${hue} 95% 62%)`} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`c${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={light} />
          <stop offset="1" stopColor={mid} />
        </linearGradient>
      </defs>
      <circle cx="60" cy="62" r="58" fill={`url(#g${id})`} />
      <ellipse cx="60" cy="106" rx="34" ry="6" fill="#000" opacity="0.35" />

      {type === "currency" && (
        <g>
          {Array.from({ length: 2 + v }).map((_, i) => {
            const cy = 90 - i * 12;
            return (
              <g key={i}>
                <rect x="26" y={cy} width="68" height="10" fill="#b9791d" />
                <ellipse cx="60" cy={cy + 10} rx="34" ry="11" fill="#b9791d" />
                <ellipse cx="60" cy={cy} rx="34" ry="11" fill="#f5b544" />
                <ellipse cx="60" cy={cy} rx="26" ry="8" fill="none" stroke="#ffd98a" strokeWidth="1.5" />
              </g>
            );
          })}
          {(() => {
            const top = 90 - (1 + v) * 12;
            return <path d={`M60 ${top - 6} L68 ${top} L60 ${top + 6} L52 ${top}Z`} fill={deep} opacity="0.85" />;
          })()}
          <path d="M96 22l3 8 8 3-8 3-3 8-3-8-8-3 8-3z" fill="#fff" opacity="0.9" />
        </g>
      )}

      {type === "item" && (
        <g>
          <polygon points="60,18 102,40 60,62 18,40" fill={`url(#c${id})`} />
          <g transform="translate(18 40) skewY(27.5)">
            <rect width="42" height="48" fill={mid} />
            <path d="M21 14l9 12-9 12-9-12z" fill="#fff" opacity="0.92" />
          </g>
          <g transform="translate(60 62) skewY(-27.5)">
            <rect width="42" height="48" fill={dark} />
            <rect x="18" y="0" width="6" height="48" fill={deep} opacity="0.55" />
          </g>
          <polygon points="60,18 102,40 60,62 18,40" fill="none" stroke="#fff" strokeOpacity="0.35" strokeWidth="1.2" />
          <path d="M96 16l2.5 6.5 6.5 2.5-6.5 2.5-2.5 6.5-2.5-6.5-6.5-2.5 6.5-2.5z" fill="#fff" opacity="0.9" />
        </g>
      )}

      {type === "key" && (
        <g transform="rotate(-8 60 60)">
          <rect x="16" y="30" width="88" height="58" rx="9" fill={dark} />
          <rect x="16" y="30" width="88" height="58" rx="9" fill={`url(#c${id})`} opacity="0.9" />
          <rect x="16" y="42" width="88" height="9" fill={deep} opacity="0.55" />
          <circle cx="40" cy="68" r="9" fill="none" stroke="#fff" strokeWidth="4.5" />
          <path d="M49 68h28M70 68v7M62 68v5" stroke="#fff" strokeWidth="4.5" strokeLinecap="round" fill="none" />
          <g fill="#fff" opacity="0.6">
            <rect x="26" y="80" width="10" height="3" rx="1.5" />
            <rect x="40" y="80" width="6" height="3" rx="1.5" />
            <rect x="50" y="80" width="14" height="3" rx="1.5" />
            <rect x="68" y="80" width="8" height="3" rx="1.5" />
          </g>
        </g>
      )}

      {type === "service" && (
        <g>
          <path d="M30 72a30 30 0 0 1 60 0" fill="none" stroke={light} strokeWidth="7" strokeLinecap="round" />
          <rect x="21" y="64" width="17" height="30" rx="8" fill={`url(#c${id})`} />
          <rect x="82" y="64" width="17" height="30" rx="8" fill={`url(#c${id})`} />
          <path d="M90 92q0 12-20 12" fill="none" stroke={light} strokeWidth="4" strokeLinecap="round" />
          <circle cx="66" cy="104" r="5" fill={light} />
          <path d="M60 28l3 7 7.5 1-5.5 5 1.5 7.5-6.5-4-6.5 4 1.5-7.5-5.5-5 7.5-1z" fill="#f5b544" />
        </g>
      )}

      {type === "other" && (
        <g>
          <polygon points="36,44 48,26 72,26 84,44 60,98" fill={`url(#c${id})`} />
          <polygon points="36,44 84,44 60,98" fill={dark} opacity="0.55" />
          <polygon points="48,26 60,44 72,26" fill="#fff" opacity="0.35" />
          <path d="M36 44h48M48 26l12 18 12-18M60 44v54" stroke="#fff" strokeOpacity="0.4" strokeWidth="1.2" fill="none" />
          <path d="M96 22l3 8 8 3-8 3-3 8-3-8-8-3 8-3z" fill="#fff" opacity="0.9" />
        </g>
      )}
    </svg>
  );
}
