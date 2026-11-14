import { getAnonClient } from "./supabase-anon";
import type { NewsCategoria } from "@/lib/news/categories";
import type { NewsPostRow } from "@/lib/news/types";

export type { NewsPostRow } from "@/lib/news/types";

/**
 * Columnas de `news_posts` que lee el sitio público (SDD-0611 C1).
 *
 * Desde la 0526 anon solo tiene SELECT sobre estas columnas (grant por columna,
 * sin SELECT de tabla): `select("*")` falla con permiso denegado. Quedan fuera
 * `publish_via` (`'automatica'` declararía la IA, contra §4.7), `seo_draft_id`,
 * `content_sha256`, `created_by` (uuid de un usuario del Studio), `tenant_id` y
 * `source`, que ninguna página usa. Una columna nueva que lea el sitio público
 * exige migración con su GRANT además de sumarse al literal. Catálogo de producción leído por el DG el 2026-11-09 (estructura, sin filas):
 * 24 columnas. `content_kind`, `cover_image_url`, `cover_alt`, `featured`,
 * `reviewer_name` y `reviewer_role` NO existen: pedirlas vaciaría /noticias.
 */
// Un literal y no un join: supabase-js lee el texto del select para tipar la fila.
const COLUMNAS_PUBLICAS =
  "id,slug,tipo,categoria,title,excerpt,body_markdown,author_name,author_role,focus_keyword,secondary_keywords,meta_description,pain_points,date,read_time_min,published,created_at,updated_at";

export async function listPublishedPosts(limit?: number): Promise<NewsPostRow[]> {
  try {
    const supabase = getAnonClient();
    let query = supabase
      .from("news_posts")
      .select(COLUMNAS_PUBLICAS)
      .eq("published", true)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });

    if (typeof limit === "number" && limit > 0) query = query.limit(limit);

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as NewsPostRow[];
  } catch (error) {
    console.error("listPublishedPosts error:", error);
    return [];
  }
}

export async function getPostBySlug(slug: string): Promise<NewsPostRow | null> {
  try {
    const { data, error } = await getAnonClient()
      .from("news_posts")
      .select(COLUMNAS_PUBLICAS)
      .eq("slug", slug)
      .eq("published", true)
      .maybeSingle<NewsPostRow>();
    if (error) throw error;
    return data ?? null;
  } catch (error) {
    console.error("getPostBySlug error:", error);
    return null;
  }
}

export async function getRelatedPosts(
  currentSlug: string,
  categoria: NewsCategoria,
  limit = 3,
): Promise<NewsPostRow[]> {
  try {
    const supabase = getAnonClient();
    const { data: same, error: sameError } = await supabase
      .from("news_posts")
      .select(COLUMNAS_PUBLICAS)
      .eq("published", true)
      .eq("categoria", categoria)
      .neq("slug", currentSlug)
      .order("date", { ascending: false })
      .limit(limit);
    if (sameError) throw sameError;

    const collected = (same ?? []) as NewsPostRow[];
    if (collected.length >= limit) return collected.slice(0, limit);

    const { data: others, error: otherError } = await supabase
      .from("news_posts")
      .select(COLUMNAS_PUBLICAS)
      .eq("published", true)
      .neq("slug", currentSlug)
      .neq("categoria", categoria)
      .order("date", { ascending: false })
      .limit(limit - collected.length);
    if (otherError) throw otherError;
    return [...collected, ...((others ?? []) as NewsPostRow[])];
  } catch (error) {
    console.error("getRelatedPosts error:", error);
    return [];
  }
}

export async function listPublishedSlugs(): Promise<string[]> {
  try {
    const { data, error } = await getAnonClient()
      .from("news_posts")
      .select("slug")
      .eq("published", true);
    if (error) throw error;
    return (data ?? []).map((row) => String(row.slug));
  } catch (error) {
    console.error("listPublishedSlugs error:", error);
    return [];
  }
}
