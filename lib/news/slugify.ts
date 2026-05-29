/**
 * lib/news/slugify.ts · Plan v4 · Phase E
 *
 * Generación de slugs URL-safe para news_posts.
 *
 * Reglas:
 *  - lowercase
 *  - sin tildes ni ñ (normalize NFD + strip combining marks)
 *  - solo [a-z 0-9 -]
 *  - colapsa dashes consecutivos a uno
 *  - sin dashes leading/trailing
 *  - max 80 chars (corta en boundary de palabra si es posible)
 *
 * `dedupSlug` chequea contra news_posts.slug y sufija -2/-3/... si colisiona.
 * Sequential queries (O(N)) — aceptable para volumen actual del módulo.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

const MAX_LEN = 80;
const MIN_BOUNDARY = 60;

/** Convierte texto libre en slug URL-safe. */
export function slugify(text: string): string {
  let s = (text ?? "").toString().toLowerCase().trim();

  // Strip tildes y diacríticos. Range ̀-ͯ = "Combining Diacritical
  // Marks" (en NFD, "ñ" se descompone en "n" + U+0303 que cae acá)
  s = s.normalize("NFD").replace(/[̀-ͯ]/g, "");

  // Cualquier no-alfanumérico → dash
  s = s.replace(/[^a-z0-9]+/g, "-");

  // Trim dashes leading/trailing
  s = s.replace(/^-+|-+$/g, "");

  // Truncar a 80 — preferir boundary de palabra
  if (s.length > MAX_LEN) {
    s = s.slice(0, MAX_LEN);
    const lastDash = s.lastIndexOf("-");
    if (lastDash > MIN_BOUNDARY) {
      s = s.slice(0, lastDash);
    } else {
      s = s.replace(/-+$/, "");
    }
  }

  return s;
}

/**
 * Chequea si `base` existe en news_posts.slug. Si sí, prueba `base-2`,
 * `base-3`, etc., hasta encontrar uno libre o llegar al límite de 50.
 *
 * Notas:
 *  - Usa el cliente de Supabase del caller (server action). RLS no aplica
 *    al SELECT de slug porque la policy news_posts_public_select permite
 *    leer published=true. Para drafts no-publicados el admin policy aplica.
 *  - El UNIQUE constraint en news_posts.slug es el guard final — si dos
 *    requests concurrentes publican con el mismo slug, una falla y el
 *    caller debe reintentar (acepable para v1).
 */
export async function dedupSlug(
  supabase: SupabaseClient,
  base: string,
): Promise<string> {
  if (!base) throw new Error("Slug base vacío");

  let candidate = base;
  let n = 1;

  // Hasta 50 colisiones — más allá tiramos error
  while (n <= 50) {
    const { data, error } = await supabase
      .from("news_posts")
      .select("slug")
      .eq("slug", candidate)
      .maybeSingle<{ slug: string }>();

    if (error) {
      throw new Error(`No se pudo chequear slug "${candidate}": ${error.message}`);
    }
    if (!data) return candidate;

    n++;
    candidate = `${base}-${n}`;
  }

  throw new Error(`Demasiadas colisiones para slug "${base}" (>50)`);
}
