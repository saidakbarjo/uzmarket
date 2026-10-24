import type { Metadata } from "next";
import { Suspense } from "react";
import { NewTicketForm } from "./new-ticket-form";

export const metadata: Metadata = { title: "Новое обращение" };

export default function NewTicketPage() {
  return (
    <Suspense fallback={null}>
      <NewTicketForm />
    </Suspense>
  );
}
