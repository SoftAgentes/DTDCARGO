"use client";

/**
 * <ItemList> — grilla de items del No-Olvidar (SDD-0025 Fase 3).
 * Presentacional: recibe la lista ya filtrada + el handler de apertura.
 */

import { ItemCard } from "./ItemCard";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import type { NoOlvidarItemMeta } from "@/lib/studio/no-olvidar-types";

export function ItemList({
  items,
  onOpen,
  emptyHint,
}: {
  items: NoOlvidarItemMeta[];
  onOpen: (item: NoOlvidarItemMeta) => void;
  emptyHint?: string;
}) {
  if (items.length === 0) {
    return (
      <EmptyState
        eyebrow="Sin resultados"
        title="No hay items acá"
        description={emptyHint ?? "Agrega tu primer secreto con el botón «Agregar»."}
      />
    );
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
        gap: 10,
      }}
    >
      {items.map((item) => (
        <ItemCard key={item.id} item={item} onOpen={onOpen} />
      ))}
    </div>
  );
}
