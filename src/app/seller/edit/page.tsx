import { Suspense } from "react";
import { EditPageClient } from "./edit-client";

export default function EditListingPage() {
  return (
    <Suspense>
      <EditPageClient />
    </Suspense>
  );
}
