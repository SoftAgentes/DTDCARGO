"use client";

/**
 * <ItemCard> — tarjeta de un item del No-Olvidar en la lista (SDD-0025 Fase 3).
 *
 * Solo METADATA (nombre, categoría, url/usuario, favorito). El secreto NO se
 * muestra acá — se revela lazy dentro del ItemDrawer al abrir. Click → onOpen.
 *
 * Solo tokens var(--*).
 */

import { Icon } from "@/app/studio/_components/icons";
import { Badge } from "@/app/studio/_components/ui/Badge";
import {
  categoryBadgeTone,
  categoryIcon,
  categoryLabel,
  type NoOlvidarItemMeta,
} from "@/lib/studio/no-olvidar-types";

export function ItemCard({
  item,
  onOpen,
}: {
  item: NoOlvidarItemMeta;
  onOpen: (item: NoOlvidarItemMeta) => void;
}) {
  const iconName = categoryIcon(item.category);
  const iconFn = (Icon as Record<string, (s?: number) => React.ReactNode>)[iconName] ?? Icon.lock;
  const secondary = item.username || item.url || item.notes_preview || "—";

  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      style={{
        textAlign: "left",
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 14px",
        borderRadius: "var(--r-lg)",
        border: "1px solid var(--border)",
        background: "var(--bg-surface)",
        cursor: "pointer",
        width: "100%",
      }}
    >
      <span
        style={{
          display: "grid",
          placeItems: "center",
          width: 38,
          height: 38,
          flexShrink: 0,
          borderRadius: "var(--r-md)",
          background: "var(--wine-tint)",
          color: "var(--wine)",
        }}
      >
        {iconFn(18)}
      </span>

      <span style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0, flex: 1 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span
            style={{
              font: "700 14px/1.2 var(--f-sans)",
              color: "var(--ink)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {item.name}
          </span>
          {item.favorite && (
            <span style={{ color: "var(--warning)", display: "inline-flex", flexShrink: 0 }}>
              {Icon.star(13)}
            </span>
          )}
        </span>
        <span
          style={{
            font: "500 12px/1.2 var(--f-sans)",
            color: "var(--ink-soft)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {secondary}
        </span>
      </span>

      <Badge tone={categoryBadgeTone(item.category)} size="sm">
        {categoryLabel(item.category)}
      </Badge>
    </button>
  );
}
