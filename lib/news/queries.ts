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

// Compatibilidad temporal para el Studio y enlaces históricos. Las páginas
// públicas consumen la capa autorizada `lib/public/news-queries`.
export * from "@/lib/public/news-queries";
