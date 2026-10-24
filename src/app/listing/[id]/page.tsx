import type { Metadata } from "next";
import { ListingClient } from "./listing-client";

export const metadata: Metadata = { title: "Товар" };

export default async function ListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ListingClient id={id} />;
}
