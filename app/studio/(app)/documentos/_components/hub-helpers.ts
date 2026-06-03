/**
 * Helpers PUROS del hub de Documentos (SDD-0049 Slice B). Sin React, sin
 * Supabase — solo lógica de navegación/presentación testeable.
 */

import {
  FOLDERS,
  LINK_KIND,
  type DocumentEntityType,
} from "@/lib/studio/documents/types";

export type HubView = "all" | "por-vencer" | "pendientes" | "sin-vincular";

/** Las 3 vistas de chip + la base. */
export const HUB_VIEWS: { id: HubView; label: string }[] = [
  { id: "all", label: "Todos" },
  { id: "por-vencer", label: "Por vencer / vencidos" },
  { id: "pendientes", label: "Pendientes" },
  { id: "sin-vincular", label: "Sin vincular" },
];

/**
 * Ruta de deep-link a la transacción de un documento. En V1 enlaza a la RUTA
 * BASE del módulo (no al detalle por id) porque la tabla guarda entity_id (uuid),
 * no el code humano — y client se enruta por markbox, no por id. `none` o sin
 * módulo → null (no es clickeable).
 */
export function hubDeepLink(
  entityType: DocumentEntityType,
): { label: string; href: string } | null {
  const lk = LINK_KIND[entityType];
  if (!lk || !lk.route) return null;
  return { label: lk.label, href: lk.route };
}

/**
 * Arma la query string del hub preservando los parámetros activos y aplicando
 * un patch. Vacíos/undefined se omiten; `view=all` y `folder=all` se omiten
 * (son el default → URL limpia).
 */
export function hubHref(patch: {
  folder?: string;
  view?: HubView;
  q?: string;
}): string {
  const params = new URLSearchParams();
  if (patch.folder && patch.folder !== "all") params.set("folder", patch.folder);
  if (patch.view && patch.view !== "all") params.set("view", patch.view);
  if (patch.q && patch.q.trim()) params.set("q", patch.q.trim());
  const qs = params.toString();
  return qs ? `/studio/documentos?${qs}` : "/studio/documentos";
}

/**
 * Conteo de una carpeta del árbol: si es un grupo top-level, suma sus
 * subcarpetas; si es una subcarpeta (hoja), su conteo directo. `all` = total.
 */
export function folderTreeCount(
  counts: Record<string, number>,
  folderId: string,
): number {
  if (folderId === "all") return counts.all ?? 0;
  const group = FOLDERS.find((g) => g.id === folderId);
  if (group) {
    return group.children.reduce((sum, c) => sum + (counts[c.id] ?? 0), 0);
  }
  return counts[folderId] ?? 0;
}
