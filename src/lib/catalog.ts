import type { Listing, Profile, ProductType } from "@/lib/types";

export type SortKey = "new" | "old" | "price_asc" | "price_desc";

export interface CatalogFilters {
  q: string;
  game: string; // slug игры, "" — все
  type: ProductType | "";
  inStock: boolean; // только в наличии
  minPrice: number | null;
  maxPrice: number | null;
  minRating: number; // 0 = любой
  sort: SortKey;
}

export const DEFAULT_FILTERS: CatalogFilters = {
  q: "",
  game: "",
  type: "",
  inStock: false,
  minPrice: null,
  maxPrice: null,
  minRating: 0,
  sort: "new",
};

export const PAGE_SIZE = 9;

export function parseNumber(value: string | null | undefined): number | null {
  if (value == null || value.trim() === "") return null;
  const n = Number(value.replace(/\s/g, ""));
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
}

export function filtersFromParams(params: URLSearchParams): CatalogFilters {
  const sort = params.get("sort");
  const game = (params.get("game") ?? "").slice(0, 40);
  const type = params.get("type") ?? "";
  const rating = Number(params.get("rating") ?? 0);
  return {
    q: (params.get("q") ?? "").slice(0, 100),
    game,
    type: (["item", "currency", "service", "key", "other"].includes(type) ? type : "") as CatalogFilters["type"],
    inStock: params.get("stock") === "1",
    minPrice: parseNumber(params.get("min")),
    maxPrice: parseNumber(params.get("max")),
    minRating: Number.isFinite(rating) ? Math.min(5, Math.max(0, rating)) : 0,
    sort: sort === "old" || sort === "price_asc" || sort === "price_desc" ? sort : "new",
  };
}

export function filtersToParams(f: CatalogFilters): URLSearchParams {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  if (f.game) p.set("game", f.game);
  if (f.type) p.set("type", f.type);
  if (f.inStock) p.set("stock", "1");
  if (f.minPrice != null) p.set("min", String(f.minPrice));
  if (f.maxPrice != null) p.set("max", String(f.maxPrice));
  if (f.minRating > 0) p.set("rating", String(f.minRating));
  if (f.sort !== "new") p.set("sort", f.sort);
  return p;
}

/** Товар можно купить: продавец не снял «в наличии» и остаток не нулевой. */
export function isInStock(l: Pick<Listing, "available" | "stock">): boolean {
  return l.available && (l.stock === null || l.stock > 0);
}

export function filterListings(
  listings: Listing[],
  profiles: Profile[],
  f: CatalogFilters,
): Listing[] {
  const byId = new Map(profiles.map((p) => [p.id, p]));
  const q = f.q.trim().toLowerCase();
  const result = listings.filter((l) => {
    if (l.status !== "active") return false;
    const seller = byId.get(l.sellerId);
    if (!seller || seller.blocked) return false;
    if (f.game && l.gameSlug !== f.game) return false;
    if (f.type && l.productType !== f.type) return false;
    if (f.inStock && !isInStock(l)) return false;
    if (q && !(l.title.toLowerCase().includes(q) || l.description.toLowerCase().includes(q))) return false;
    if (f.minPrice != null && l.priceUzs < f.minPrice) return false;
    if (f.maxPrice != null && l.priceUzs > f.maxPrice) return false;
    if (f.minRating > 0 && seller.rating < f.minRating) return false;
    return true;
  });
  const sorted = [...result];
  switch (f.sort) {
    case "price_asc":
      sorted.sort((a, b) => a.priceUzs - b.priceUzs);
      break;
    case "price_desc":
      sorted.sort((a, b) => b.priceUzs - a.priceUzs);
      break;
    case "old":
      sorted.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      break;
    default:
      sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  return sorted;
}

export function averageRating(ratings: number[]): number {
  if (ratings.length === 0) return 0;
  return Math.round((ratings.reduce((s, r) => s + r, 0) / ratings.length) * 10) / 10;
}
