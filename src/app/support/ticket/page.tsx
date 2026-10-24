import type { Metadata } from "next";
import { Suspense } from "react";
import { TicketPageClient } from "./ticket-client";

export const metadata: Metadata = { title: "Обращение" };

export default function TicketPage() {
  return (
    <Suspense>
      <TicketPageClient />
    </Suspense>
  );
}
