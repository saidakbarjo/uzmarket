import { describe, expect, it } from "vitest";
import { deriveProfileStats } from "@/lib/stats";
import type { Order, Profile, Review } from "@/lib/types";

const p = (id: string): Profile => ({ id, username: id, email: id, role: "user", isSeller: true, isDemo: true, blocked: false, createdAt: "", rating: 4.9, reviewsCount: 999, salesCount: 999, verified: false, about: "" });
const rv = (id: string, sellerId: string, rating: number): Review => ({ id, listingId: "l", authorId: "b", authorName: "b", sellerId, rating, text: "x", createdAt: "", isDemo: true });
const ord = (id: string, sellerId: string, status: Order["status"]) => ({ id, sellerId, status }) as Order;

describe("deriveProfileStats", () => {
  it("считает рейтинг, отзывы и продажи из фактических данных, а не из записанных чисел", () => {
    const [a, b] = deriveProfileStats([p("a"), p("b")], [rv("1", "a", 5), rv("2", "a", 4), rv("3", "a", 4)], [ord("o1", "a", "completed"), ord("o2", "a", "paid"), ord("o3", "a", "completed")]);
    expect(a.rating).toBe(4.3);
    expect(a.reviewsCount).toBe(3);
    expect(a.salesCount).toBe(2);
    expect(b.rating).toBe(0);
    expect(b.reviewsCount).toBe(0);
    expect(b.salesCount).toBe(0);
  });
  it("скрытые отзывы не учитываются", () => {
    const [a] = deriveProfileStats([p("a")], [rv("1", "a", 5), rv("2", "a", 1)], [], ["2"]);
    expect(a.rating).toBe(5);
    expect(a.reviewsCount).toBe(1);
  });
});
