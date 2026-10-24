import { describe, expect, it } from "vitest";
import { DEFAULT_FILTERS, averageRating, filterListings, filtersFromParams, filtersToParams } from "@/lib/catalog";
import { seedListings, seedProfiles, categories } from "@/lib/data/seed";

describe("данные", () => {
  it("минимум 20 объявлений, у каждого продавец и категория", () => {
    expect(seedListings.length).toBeGreaterThanOrEqual(20);
    const slugs = new Set(categories.map((c) => c.slug));
    for (const l of seedListings) {
      expect(slugs.has(l.categorySlug)).toBe(true);
      expect(seedProfiles.some((p) => p.id === l.sellerId)).toBe(true);
      expect(Number.isInteger(l.priceUzs)).toBe(true);
      expect(l.priceUzs).toBeGreaterThan(0);
    }
  });

  it("представлены все 9 категорий", () => {
    const used = new Set(seedListings.map((l) => l.categorySlug));
    expect(used.size).toBe(9);
  });
});

describe("фильтры каталога", () => {
  const run = (patch: Partial<typeof DEFAULT_FILTERS>) =>
    filterListings(seedListings, seedProfiles, { ...DEFAULT_FILTERS, ...patch });

  it("без фильтров возвращает все активные", () => {
    expect(run({})).toHaveLength(seedListings.length);
  });

  it("поиск по названию", () => {
    const r = run({ q: "логотип" });
    expect(r.length).toBeGreaterThan(0);
    expect(r.every((l) => (l.title + l.description).toLowerCase().includes("логотип"))).toBe(true);
  });

  it("категория", () => {
    const r = run({ category: "keys" });
    expect(r.length).toBeGreaterThan(0);
    expect(r.every((l) => l.categorySlug === "keys")).toBe(true);
  });

  it("мин. и макс. цена", () => {
    const r = run({ minPrice: 100_000, maxPrice: 200_000 });
    expect(r.length).toBeGreaterThan(0);
    expect(r.every((l) => l.priceUzs >= 100_000 && l.priceUzs <= 200_000)).toBe(true);
  });

  it("сортировка по цене", () => {
    const asc = run({ sort: "price_asc" }).map((l) => l.priceUzs);
    expect(asc).toEqual([...asc].sort((a, b) => a - b));
    const desc = run({ sort: "price_desc" }).map((l) => l.priceUzs);
    expect(desc).toEqual([...desc].sort((a, b) => b - a));
  });

  it("сортировка по дате", () => {
    const newest = run({ sort: "new" }).map((l) => l.createdAt);
    expect(newest).toEqual([...newest].sort().reverse());
    const oldest = run({ sort: "old" }).map((l) => l.createdAt);
    expect(oldest).toEqual([...oldest].sort());
  });

  it("рейтинг продавца", () => {
    const r = run({ minRating: 4.8 });
    expect(r.length).toBeGreaterThan(0);
    expect(r.length).toBeLessThan(seedListings.length);
    for (const l of r) {
      expect(seedProfiles.find((p) => p.id === l.sellerId)!.rating).toBeGreaterThanOrEqual(4.8);
    }
  });

  it("«ничего не найдено»", () => {
    expect(run({ q: "несуществующийтовар123" })).toHaveLength(0);
  });

  it("скрывает приостановленные объявления и объявления заблокированных продавцов", () => {
    const paused = seedListings.map((l, i) => (i === 0 ? { ...l, status: "paused" as const } : l));
    expect(filterListings(paused, seedProfiles, DEFAULT_FILTERS)).toHaveLength(seedListings.length - 1);
    const blocked = seedProfiles.map((p) => (p.id === "u-nur" ? { ...p, blocked: true } : p));
    const visible = filterListings(seedListings, blocked, DEFAULT_FILTERS);
    expect(visible.some((l) => l.sellerId === "u-nur")).toBe(false);
  });

  it("параметры URL туда-обратно", () => {
    const f = { ...DEFAULT_FILTERS, q: "ключ", category: "keys" as const, minPrice: 1000, maxPrice: 5000, minRating: 4, sort: "price_asc" as const };
    expect(filtersFromParams(filtersToParams(f))).toEqual(f);
  });

  it("некорректные параметры URL не ломают фильтры", () => {
    const f = filtersFromParams(new URLSearchParams("min=abc&max=-5&rating=99&sort=hack"));
    expect(f.minPrice).toBeNull();
    expect(f.maxPrice).toBeNull();
    expect(f.minRating).toBe(5);
    expect(f.sort).toBe("new");
  });

  it("средний рейтинг", () => {
    expect(averageRating([])).toBe(0);
    expect(averageRating([5, 4, 4])).toBe(4.3);
  });
});
