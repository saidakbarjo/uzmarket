import type { Metadata } from "next";
import { TicketClient } from "./ticket-client";

export const metadata: Metadata = { title: "Обращение" };

export default async function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TicketClient id={id} />;
}
