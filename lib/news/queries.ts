/**
 * lib/news/queries.ts · Plan v4 · Phase F
 *
 * Queries DB-backed para el sitio público /noticias y /noticias/[slug].
 *
 * - Usa `createClient()` (anon + cookies) — la RLS policy `news_posts_public_select`
 *   permite SELECT anon cuando `published = true`. Cero leak de borradores.
 * - No usa unstable_cache · el cache de página de Next.js + el `revalidatePath`
 *   que dispara `publishPost` es suficiente para v1.
 * - Devuelve filas tipadas que mapean 1:1 a columnas de `news_posts`.
 */

import { createClient } from "@/lib/db/server";
import type { NewsCategoria, NewsTipo } from "./categories";

export interface NewsPostRow {
  id: string;
  slug: string;
  tipo: NewsTipo;
  categoria: NewsCategoria;
  title: string;
  excerpt: string;
  body_markdown: string;
  author_name: string;
  author_role: string | null;
  focus_keyword: string | null;
  secondary_keywords: string[];
  meta_description: string | null;
  pain_points: string[];
  date: string;
  read_time_min: number;
  published: boolean;
  source: "manual" | "seo-generator";
  created_at: string;
}

/**
 * Lista todos los posts publicados ordenados por fecha descendente.
 * Si falla la query, devuelve [] (no rompe la página).
 */
export async function listPublishedPosts(limit?: number): Promise<NewsPostRow[]> {
  const supabase = await createClient();
  let query = supabase
    .from("news_posts")
    .select("*")
    .eq("published", true)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });

  if (typeof limit === "number" && limit > 0) {
    query = query.limit(limit);
  }

  const { data, error } = await query;
  if (error) {
    console.error("listPublishedPosts error:", error.message);
    return [];
  }
  return (data ?? []) as NewsPostRow[];
}

/** Devuelve el post por slug si está publicado. null si no existe o no publicado. */
export async function getPostBySlug(slug: string): Promise<NewsPostRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("news_posts")
    .select("*")
    .eq("slug", slug)
    .eq("published", true)
    .maybeSingle<NewsPostRow>();
  if (error) {
    console.error("getPostBySlug error:", error.message);
    return null;
  }
  return data ?? null;
}

/**
 * Posts relacionados:
 *   1. Misma categoría que el actual (más recientes primero, excluye el actual).
 *   2. Si faltan para llegar a `limit`, completa con cualquier otro post.
 *
 * Dos queries secuenciales en vez de una con OR complejo — más legible y
 * eficiente con índices existentes.
 */
export async function getRelatedPosts(
  currentSlug: string,
  categoria: NewsCategoria,
  limit = 2,
): Promise<NewsPostRow[]> {
  const supabase = await createClient();

  const { data: same, error: sErr } = await supabase
    .from("news_posts")
    .select("*")
    .eq("published", true)
    .eq("categoria", categoria)
    .neq("slug", currentSlug)
    .order("date", { ascending: false })
    .limit(limit);

  if (sErr) {
    console.error("getRelatedPosts (same) error:", sErr.message);
  }

  const collected = (same ?? []) as NewsPostRow[];
  if (collected.length >= limit) return collected.slice(0, limit);

  const need = limit - collected.length;
  const { data: others, error: oErr } = await supabase
    .from("news_posts")
    .select("*")
    .eq("published", true)
    .neq("slug", currentSlug)
    .neq("categoria", categoria)
    .order("date", { ascending: false })
    .limit(need);

  if (oErr) {
    console.error("getRelatedPosts (others) error:", oErr.message);
  }

  return [...collected, ...((others ?? []) as NewsPostRow[])];
}

/** Slugs de todos los posts publicados — útil para generateStaticParams. */
export async function listPublishedSlugs(): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("news_posts")
    .select("slug")
    .eq("published", true);
  if (error) {
    console.error("listPublishedSlugs error:", error.message);
    return [];
  }
  return (data ?? []).map((r) => r.slug as string);
}
