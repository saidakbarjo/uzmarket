import type { Metadata } from "next";
import { FavoritesView } from "@/components/favorites-view";

export const metadata: Metadata = { title: "Избранное" };

export default function Page() {
  return <FavoritesView />;
}
