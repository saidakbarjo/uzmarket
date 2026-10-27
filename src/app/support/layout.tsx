import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = { title: "Поддержка и обращения" };

export default function SupportLayout({ children }: { children: ReactNode }) {
  return children;
}
