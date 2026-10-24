"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, SearchX, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ListingCard } from "@/components/listing-card";
import { CategoryIcon, EmptyState, PageHeader } from "@/components/ui";
import {
  PAGE_SIZE,
  filterListings,
  filtersFromParams,
  filtersToParams,
  type CatalogFilters,
  type SortKey,
} from "@/lib/catalog";
import { categories } from "@/lib/data/seed";
import { useDemoState, useHydrated } from "@/lib/store";

export function CatalogClient() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const s = useDemoState();
  const hydrated = useHydrated();
  const [showFilters, setShowFilters] = useState(false);

  const filters = useMemo(() => filtersFromParams(new URLSearchParams(params.toString())), [params]);
  const page = Math.max(1, Math.floor(Number(params.get("page") ?? 1)) || 1);

  const qRef = useRef<HTMLInputElement>(null);
  const minRef = useRef<HTMLInputElement>(null);
  const maxRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const results = useMemo(() => filterListings(s.listings, s.profiles, filters), [s.listings, s.profiles, filters]);
  const totalPages = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = results.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const visibleCategories = categories.filter((c) => !s.disabledCategories.includes(c.slug));

  // если фильтры изменились снаружи (например, поиск из шапки) — обновляем поля ввода
  useEffect(() => {
    const sync = (el: HTMLInputElement | null, value: string) => {
      if (el && document.activeElement !== el && el.value !== value) el.value = value;
    };
    sync(qRef.current, filters.q);
    sync(minRef.current, filters.minPrice != null ? String(filters.minPrice) : "");
    sync(maxRef.current, filters.maxPrice != null ? String(filters.maxPrice) : "");
  }, [filters]);

  function currentFromInputs(): CatalogFilters {
    const num = (v: string | undefined) => {
      if (!v || !v.trim()) return null;
      const n = Number(v.replace(/\s/g, ""));
      return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
    };
    return {
      ...filters,
      q: (qRef.current?.value ?? filters.q).slice(0, 100),
      minPrice: num(minRef.current?.value),
      maxPrice: num(maxRef.current?.value),
    };
  }

  function apply(patch: Partial<CatalogFilters> = {}, nextPage = 1) {
    const f = { ...currentFromInputs(), ...patch };
    const p = filtersToParams(f);
    if (nextPage > 1) p.set("page", String(nextPage));
    const qs = p.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  function debounced() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => apply(), 350);
  }

  function reset() {
    if (qRef.current) qRef.current.value = "";
    if (minRef.current) minRef.current.value = "";
    if (maxRef.current) maxRef.current.value = "";
    router.replace(pathname, { scroll: false });
  }

  function goPage(n: number) {
    const p = filtersToParams(filters);
    if (n > 1) p.set("page", String(n));
    const qs = p.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: true });
  }

  const activeCount =
    (filters.q ? 1 : 0) +
    (filters.category ? 1 : 0) +
    (filters.minPrice != null ? 1 : 0) +
    (filters.maxPrice != null ? 1 : 0) +
    (filters.minRating > 0 ? 1 : 0);

  const priceInvalid = filters.minPrice != null && filters.maxPrice != null && filters.minPrice > filters.maxPrice;

  const filterPanel = (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        apply();
      }}
      className="space-y-6"
      aria-label="Фильтры каталога"
    >
      <div>
        <label htmlFor="q" className="mb-1.5 block text-sm font-medium">Поиск по названию</label>
        <input
          id="q"
          ref={qRef}
          defaultValue={filters.q}
          onChange={debounced}
          className="input"
          placeholder="Например: логотип"
          maxLength={100}
        />
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-medium">Категория</legend>
        <div className="space-y-1">
          <button
            type="button"
            onClick={() => apply({ category: "" })}
            aria-pressed={filters.category === ""}
            className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${filters.category === "" ? "bg-accent/15 font-semibold text-ink" : "text-muted hover:bg-panel-2"}`}
          >
            Все категории
          </button>
          {visibleCategories.map((c) => (
            <button
              key={c.slug}
              type="button"
              onClick={() => apply({ category: c.slug })}
              aria-pressed={filters.category === c.slug}
              className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${filters.category === c.slug ? "bg-accent/15 font-semibold text-ink" : "text-muted hover:bg-panel-2"}`}
            >
              <CategoryIcon slug={c.slug} className="h-4 w-4 shrink-0" />
              <span className="truncate">{c.name}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-medium">Цена, сум</legend>
        <div className="grid grid-cols-2 gap-2">
          <input ref={minRef} defaultValue={filters.minPrice ?? ""} onChange={debounced} inputMode="numeric" className="input" placeholder="от" aria-label="Минимальная цена" />
          <input ref={maxRef} defaultValue={filters.maxPrice ?? ""} onChange={debounced} inputMode="numeric" className="input" placeholder="до" aria-label="Максимальная цена" />
        </div>
        {priceInvalid && <p role="alert" className="mt-1.5 text-xs text-danger">Минимальная цена больше максимальной</p>}
      </fieldset>

      <div>
        <label htmlFor="rating" className="mb-1.5 block text-sm font-medium">Рейтинг продавца</label>
        <select id="rating" className="input" value={String(filters.minRating)} onChange={(e) => apply({ minRating: Number(e.target.value) })}>
          <option value="0">Любой</option>
          <option value="4">от 4.0</option>
          <option value="4.5">от 4.5</option>
          <option value="4.8">от 4.8</option>
        </select>
      </div>

      <button type="button" onClick={reset} disabled={activeCount === 0} className="btn-ghost w-full">
        <X className="h-4 w-4" aria-hidden /> Сбросить фильтры
      </button>
    </form>
  );

  return (
    <div>
      <PageHeader
        title="Каталог"
        subtitle={hydrated ? `Найдено: ${results.length}` : "Загрузка…"}
        actions={
          <div className="flex items-center gap-2">
            <label htmlFor="sort" className="sr-only">Сортировка</label>
            <select id="sort" className="input !w-auto" value={filters.sort} onChange={(e) => apply({ sort: e.target.value as SortKey })}>
              <option value="new">Сначала новые</option>
              <option value="old">Сначала старые</option>
              <option value="price_asc">Цена: по возрастанию</option>
              <option value="price_desc">Цена: по убыванию</option>
            </select>
            <button type="button" className="btn-ghost lg:hidden" onClick={() => setShowFilters((v) => !v)} aria-expanded={showFilters}>
              <SlidersHorizontal className="h-4 w-4" aria-hidden /> Фильтры{activeCount ? ` (${activeCount})` : ""}
            </button>
          </div>
        }
      />

      <div className="grid gap-8 lg:grid-cols-[18rem_1fr]">
        <aside className={`${showFilters ? "block" : "hidden"} lg:block`}>
          <div className="card p-5 lg:sticky lg:top-24">{filterPanel}</div>
        </aside>

        <section aria-live="polite">
          {pageItems.length === 0 ? (
            <EmptyState
              icon={<SearchX className="h-7 w-7" aria-hidden />}
              title="Ничего не найдено"
              text="Попробуйте изменить запрос, расширить диапазон цены или сбросить фильтры."
            />
          ) : (
            <>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {pageItems.map((l) => (
                  <ListingCard key={l.id} listing={l} />
                ))}
              </div>
              {totalPages > 1 && (
                <nav className="mt-8 flex items-center justify-center gap-2" aria-label="Страницы каталога">
                  <button type="button" className="btn-ghost !px-3" disabled={safePage <= 1} onClick={() => goPage(safePage - 1)} aria-label="Предыдущая страница">
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  {Array.from({ length: totalPages }).map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => goPage(i + 1)}
                      aria-current={safePage === i + 1 ? "page" : undefined}
                      className={`h-10 min-w-10 rounded-xl px-3 text-sm font-semibold transition ${safePage === i + 1 ? "bg-accent text-white" : "border border-line bg-panel-2 text-muted hover:text-ink"}`}
                    >
                      {i + 1}
                    </button>
                  ))}
                  <button type="button" className="btn-ghost !px-3" disabled={safePage >= totalPages} onClick={() => goPage(safePage + 1)} aria-label="Следующая страница">
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </nav>
              )}
            </>
          )}
          <p className="mt-6 text-xs text-muted">
            Все объявления в демо-режиме — тестовые. <Link href="/legal/rules" className="text-accent hover:underline">Правила площадки</Link>
          </p>
        </section>
      </div>
    </div>
  );
}
