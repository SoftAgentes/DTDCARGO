/**
 * lib/news/writers.ts · Plan v4 · Phase E
 *
 * Resolución del escritor externo asignado a un post según su tipo
 * editorial + helpers para mostrar disclaimer al pie del artículo.
 *
 * Reglas:
 *  - informativo  → Miguel Arriaga (único activo)
 *  - curiosidad   → Adriana ↔ Claudia, rotación LRU sobre news_posts.created_at
 *  - polemica     → Ernesto Piñérez (único activo)
 *  - especial     → null (DTD Cargo directo, sin disclaimer)
 *
 * El rol de autor se deriva del tipo (no del género del writer puntual)
 * para mantener consistencia editorial. Si en el futuro entra un writer
 * de género distinto al esperado, el PublishModal permite override manual
 * en v1.1+.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { NewsTipo } from "./categories";

export interface NewsWriter {
  id: string;
  name: string;
  tipo: NewsTipo;
  active: boolean;
  display_order: number;
}

/** Rol editorial a mostrar al pie del artículo (NULL = sin disclaimer). */
export const AUTHOR_ROLE_BY_TIPO: Record<NewsTipo, string | null> = {
  informativo: "Periodista colaborador invitado",
  curiosidad: "Escritora invitada", // seed actual: Adriana + Claudia (F)
  polemica: "Columnista invitado",
  especial: null,
};

export interface WriterAssignment {
  /** null si tipo='especial' (DTD Cargo directo) */
  writer: NewsWriter | null;
  /** author_name a guardar en news_posts (writer.name o "DTD Cargo") */
  authorName: string;
  /** author_role a guardar (null para especial) */
  authorRole: string | null;
}

/**
 * Resuelve el escritor para un nuevo post según su tipo:
 *  - especial: null + autor "DTD Cargo"
 *  - 1 solo writer activo: ese
 *  - múltiples writers: rotación LRU sobre la última publicación del tipo
 */
export async function getNextWriter(
  supabase: SupabaseClient,
  tenantId: string,
  tipo: NewsTipo,
): Promise<WriterAssignment> {
  if (tipo === "especial") {
    return { writer: null, authorName: "DTD Cargo", authorRole: null };
  }

  const writers = await getActiveWriters(supabase, tenantId, tipo);
  if (writers.length === 0) {
    throw new Error(`No hay writers activos para tipo "${tipo}"`);
  }

  if (writers.length === 1) {
    return buildAssignment(writers[0], tipo);
  }

  // Rotación LRU — buscamos la última publicación del tipo
  const { data: lastPost, error: pErr } = await supabase
    .from("news_posts")
    .select("author_name")
    .eq("tenant_id", tenantId)
    .eq("tipo", tipo)
    .eq("published", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ author_name: string }>();

  if (pErr) {
    throw new Error(`No se pudo leer última publicación: ${pErr.message}`);
  }

  if (!lastPost) {
    // Sin posts previos del tipo → primer writer (display_order=1)
    return buildAssignment(writers[0], tipo);
  }

  const lastIdx = writers.findIndex((w) => w.name === lastPost.author_name);
  // Si no encontramos al writer (renombrado/desactivado), fallback al primero
  const nextIdx = lastIdx === -1 ? 0 : (lastIdx + 1) % writers.length;
  return buildAssignment(writers[nextIdx], tipo);
}

/** Lista de writers activos para un tipo (vacío para especial). */
export async function getActiveWriters(
  supabase: SupabaseClient,
  tenantId: string,
  tipo: NewsTipo,
): Promise<NewsWriter[]> {
  if (tipo === "especial") return [];

  const { data, error } = await supabase
    .from("news_writers")
    .select("id, name, tipo, active, display_order")
    .eq("tenant_id", tenantId)
    .eq("tipo", tipo)
    .eq("active", true)
    .order("display_order", { ascending: true });

  if (error) throw new Error(`No se pudo cargar writers: ${error.message}`);
  return (data ?? []) as NewsWriter[];
}

function buildAssignment(writer: NewsWriter, tipo: NewsTipo): WriterAssignment {
  return {
    writer,
    authorName: writer.name,
    authorRole: AUTHOR_ROLE_BY_TIPO[tipo],
  };
}

/**
 * Texto del disclaimer al pie del artículo público. Devuelve null para
 * tipo="especial" (Anuncios DTD — sin disclaimer, autor = DTD Cargo).
 *
 * Esta es la versión v1 — copy fijo por tipo. v1.1+ podría hacer el copy
 * editable desde el Studio.
 */
export function getDisclaimer(
  tipo: NewsTipo,
  authorName: string,
): string | null {
  switch (tipo) {
    case "informativo":
      return `Artículo redactado por ${authorName}, periodista colaborador invitado. Análisis profesional independiente sobre logística y comercio China-Venezuela.`;
    case "curiosidad":
      return `Artículo redactado por ${authorName}, escritora invitada. Perspectiva editorial sobre comercio internacional y cultura china.`;
    case "polemica":
      return `Columna de opinión escrita por ${authorName}, columnista invitado. Las opiniones expresadas son personales y no representan necesariamente la postura oficial de DTD Cargo.`;
    case "especial":
      return null;
  }
}
