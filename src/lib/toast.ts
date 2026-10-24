"use client";

import { useSyncExternalStore } from "react";

export interface ToastItem {
  id: number;
  kind: "success" | "error" | "info";
  text: string;
}

let items: ToastItem[] = [];
let counter = 0;
const listeners = new Set<() => void>();
const EMPTY: ToastItem[] = [];

function emit() {
  listeners.forEach((l) => l());
}

function push(kind: ToastItem["kind"], text: string) {
  const id = ++counter;
  items = [...items, { id, kind, text }].slice(-4);
  emit();
  setTimeout(() => dismiss(id), 4500);
}

export function dismiss(id: number) {
  items = items.filter((i) => i.id !== id);
  emit();
}

export const toast = {
  success: (t: string) => push("success", t),
  error: (t: string) => push("error", t),
  info: (t: string) => push("info", t),
};

export function useToasts(): ToastItem[] {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => items,
    () => EMPTY,
  );
}
