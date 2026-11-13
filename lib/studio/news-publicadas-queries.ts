/**
 * SDD-0625 · Lecturas de la pantalla «Publicadas» (Studio › Marketing › Noticias web).
 *
 * - Publicadas: `news_posts` con `published = true` del tenant. La policy de
 *   lectura de 0055 solo deja ver publicadas, también al admin.
 * - Retiradas: salen de `news_post_exits` (0518, lectura solo admin), la última
 *   salida de cada noticia que ya no aparece entre las publicadas. Una salida
 *   `borrada` no se lista: esa fila ya no existe y no se puede volver a publicar.
 *
 * Solo columnas para la lista y el formulario: nada de `created_by`, notas de
 * retiro ni actor (la nota la escribe una persona y puede traer algo personal).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { NewsCategoria, NewsTipo } from "@/lib/news/categories";

export interface NoticiaPublicada {
  id: string;
  slug: string;
  title: string;
  categoria: NewsCategoria;
  tipo: NewsTipo;
  date: string;
  updated_at: string;
  publish_via: "manual" | "automatica" | null;
}

export interface NoticiaRetirada {
  id: string;
  slug: string;
  title: string;
  retiradaEl: string;
  motivo: string | null;
}

export interface NoticiaParaEditar {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  body_markdown: string;
  categoria: NewsCategoria;
  tipo: NewsTipo;
  meta_description: string | null;
  focus_keyword: string | null;
  date: string;
  updated_at: string;
}

interface FilaSalida {
  post_id: string;
  slug: string;
  title: string;
  kind: "retiro" | "despublicada" | "borrada";
  reason: string | null;
  created_at: string;
}

export async function listarNoticiasDelSitio(
  supabase: SupabaseClient,
  tenantId: string,
): Promise<{ publicadas: NoticiaPublicada[]; retiradas: NoticiaRetirada[]; error: string | null }> {
  const [pub, salidas] = await Promise.all([
    supabase
      .from("news_posts")
      .select("id, slug, title, categoria, tipo, date, updated_at, publish_via")
      .eq("tenant_id", tenantId)
      .eq("published", true)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("news_post_exits")
      .select("post_id, slug, title, kind, reason, created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  if (pub.error) {
    return { publicadas: [], retiradas: [], error: "No se pudieron leer las noticias publicadas" };
  }
  const publicadas = (pub.data ?? []) as NoticiaPublicada[];
  const visibles = new Set(publicadas.map((p) => p.id));

  // Sin la 0518 (o si falla la lectura) la lista de retiradas queda vacía:
  // no se inventa nada.
  const vistas = new Set<string>();
  const retiradas: NoticiaRetirada[] = [];
  for (const s of (salidas.error ? [] : (salidas.data ?? [])) as FilaSalida[]) {
    if (vistas.has(s.post_id)) continue; // ya tomamos la salida más reciente
    vistas.add(s.post_id);
    if (visibles.has(s.post_id) || s.kind === "borrada") continue;
    retiradas.push({ id: s.post_id, slug: s.slug, title: s.title, retiradaEl: s.created_at, motivo: s.reason });
  }

  return { publicadas, retiradas, error: null };
}

export async function cargarNoticiaPublicada(
  supabase: SupabaseClient,
  tenantId: string,
  id: string,
): Promise<NoticiaParaEditar | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data, error } = await supabase
    .from("news_posts")
    .select(
      "id, slug, title, excerpt, body_markdown, categoria, tipo, meta_description, focus_keyword, date, updated_at",
    )
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .eq("published", true)
    .maybeSingle<NoticiaParaEditar>();
  if (error) return null;
  return data ?? null;
}
