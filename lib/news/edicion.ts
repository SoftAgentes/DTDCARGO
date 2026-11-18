/**
 * SDD-0625 · Editar una noticia ya publicada: qué se puede cambiar y qué no.
 *
 * Reglas puras (sin DB) para que la action y la pantalla digan lo mismo:
 *   - se editan titular, bajada, cuerpo, categoría (dentro del mismo tipo) y SEO
 *     (meta descripción y palabra clave);
 *   - el slug NO cambia: rompería enlaces compartidos y el mapa del sitio;
 *   - una marca `[VERIFICAR` bloquea guardar igual que bloquea publicar
 *     (SDD-0611 §3 y criterio 3), en cualquiera de los textos.
 */

import { NEWS_CATEGORIES_V4, type NewsCategoria, type NewsTipo } from "@/lib/news/categories";
import { tieneMarca } from "@/lib/news/autopublicar/marcas";
import { tiempoDeLectura } from "@/lib/news/derivados";

/** Lo mismo que exige publishPost para publicar. */
export const CUERPO_MIN = 200;
export const TITULO_MAX = 200;
export const BAJADA_MAX = 400;
export const META_MAX = 320;
export const KEYWORD_MAX = 120;

export interface EdicionNoticia {
  title: string;
  excerpt: string;
  body_markdown: string;
  categoria: string;
  meta_description: string;
  focus_keyword: string;
}

/** Las únicas columnas que la edición escribe. Ni slug, ni published, ni origen. */
export interface CambiosNoticia {
  title: string;
  excerpt: string;
  body_markdown: string;
  categoria: NewsCategoria;
  meta_description: string | null;
  focus_keyword: string | null;
  read_time_min: number;
}

export type ResultadoValidacion =
  | { ok: true; cambios: CambiosNoticia }
  | { ok: false; error: string };

const texto = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/**
 * Valida la edición contra el tipo de la noticia guardada. `tipo` viene de la
 * fila, nunca del formulario: la categoría solo cambia dentro del mismo tipo.
 */
export function validarEdicion(input: EdicionNoticia, tipo: NewsTipo): ResultadoValidacion {
  const title = texto(input.title);
  const excerpt = texto(input.excerpt);
  const body = texto(input.body_markdown);
  const meta = texto(input.meta_description);
  const keyword = texto(input.focus_keyword);

  if (!title) return { ok: false, error: "Falta el titular" };
  if (title.length > TITULO_MAX) return { ok: false, error: `El titular pasa de ${TITULO_MAX} caracteres` };
  if (!excerpt) return { ok: false, error: "Falta la bajada" };
  if (excerpt.length > BAJADA_MAX) return { ok: false, error: `La bajada pasa de ${BAJADA_MAX} caracteres` };
  if (body.length < CUERPO_MIN) {
    return { ok: false, error: `El artículo es muy corto (mínimo ${CUERPO_MIN} caracteres)` };
  }
  if (meta.length > META_MAX) return { ok: false, error: `La meta descripción pasa de ${META_MAX} caracteres` };
  if (keyword.length > KEYWORD_MAX) return { ok: false, error: `La palabra clave pasa de ${KEYWORD_MAX} caracteres` };

  const info = NEWS_CATEGORIES_V4[input.categoria as NewsCategoria];
  if (!info) return { ok: false, error: "Categoría inválida" };
  if (info.tipo !== tipo) {
    return { ok: false, error: "La categoría tiene que ser del mismo tipo de la noticia" };
  }

  if (tieneMarca(title, excerpt, body, meta, keyword)) {
    return {
      ok: false,
      error: "Quedan marcas [VERIFICAR] sin resolver: corrígelas antes de guardar",
    };
  }

  return {
    ok: true,
    cambios: {
      title,
      excerpt,
      body_markdown: body,
      categoria: input.categoria as NewsCategoria,
      meta_description: meta || null,
      focus_keyword: keyword || null,
      read_time_min: tiempoDeLectura(body),
    },
  };
}
