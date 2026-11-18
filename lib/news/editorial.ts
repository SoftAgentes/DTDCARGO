import type { NewsCategoria, NewsTipo } from "./categories";
import { esUrlDePortadaPermitida, portadaDeRegistro } from "./portada";
import type { NewsContentKind, NewsPostRow } from "./types";

export const CONTENT_KIND_LABELS: Record<NewsContentKind, string> = {
  guide: "Guía",
  news: "Noticia",
  analysis: "Análisis",
  case: "Caso real",
};

export const CATEGORY_IMAGES: Record<NewsCategoria, { src: string; alt: string }> = {
  "importa-sin-perder-plata": {
    src: "/fotos/dtd-cargo-carga-consolidada.webp",
    alt: "Carga de DTD Cargo preparada para envío marítimo",
  },
  "que-se-mueve-en-china": {
    src: "/fotos/bodega-yiwu-china-recepcion-consolidacion-dtd-cargo.jpg",
    alt: "Operación de recepción y consolidación de DTD Cargo en Yiwu",
  },
  "como-llega-tu-mercancia": {
    src: "/fotos/dtd-cargo-camion-entrega.webp",
    alt: "Camión de DTD Cargo recibiendo carga para su entrega",
  },
  "venezuela-y-tu-bolsillo": {
    src: "/fotos/dtd-cargo-operacion-puerto.webp",
    alt: "Equipo de DTD Cargo manejando carga en el puerto",
  },
  "historias-reales": {
    src: "/fotos/dtd-cargo-equipo-contenedor.webp",
    alt: "Equipo de DTD Cargo junto a un contenedor",
  },
  "novedades-dtd": {
    src: "/fotos/bodega-yiwu-china-recepcion-consolidacion-dtd-cargo.jpg",
    alt: "Equipo y operación logística de DTD Cargo en China",
  },
};

function validContentKind(value: unknown): value is NewsContentKind {
  return value === "guide" || value === "news" || value === "analysis" || value === "case";
}

export function contentKindOf(post: Pick<NewsPostRow, "content_kind" | "categoria" | "tipo">): NewsContentKind {
  if (validContentKind(post.content_kind)) return post.content_kind;
  if (post.categoria === "novedades-dtd") return "news";
  if (post.categoria === "historias-reales") return "case";
  if (post.tipo === "polemica") return "analysis";
  return "guide";
}

export function articleSchemaTypeOf(post: Pick<NewsPostRow, "content_kind" | "categoria" | "tipo">) {
  const kind = contentKindOf(post);
  if (kind === "guide") return "BlogPosting" as const;
  if (kind === "news") return "NewsArticle" as const;
  return "Article" as const;
}

export interface EditorialImage {
  src: string;
  alt: string;
  /** Solo si la foto es de la fuente o de un banco y la licencia pide crédito. */
  credito: string | null;
  licencia: string | null;
  enlaceOrigen: string | null;
}

/**
 * Foto de portada de una noticia, o `null` si no hay una que se pueda mostrar
 * (SDD-0611 §11.5). Orden: la portada propia de la noticia, solo con licencia
 * registrada y URL permitida (ruta propia versionada o host permitido); si no,
 * el respaldo propio de su categoría; si ese tampoco pasa la guarda, sin foto.
 * Quien pinta tiene que manejar `null`: sin hueco roto ni imagen de relleno.
 */
export function editorialImageOf(
  post: Pick<NewsPostRow, "categoria" | "title"> &
    Partial<
      Pick<
        NewsPostRow,
        "cover_image_url" | "cover_alt" | "cover_origin" | "cover_credit" | "cover_license" | "cover_source_url"
      >
    >,
): EditorialImage | null {
  const propia = portadaDeRegistro(post);
  if (propia) {
    return {
      src: propia.src,
      alt: propia.alt ?? post.title,
      credito: propia.credito,
      licencia: propia.licencia,
      enlaceOrigen: propia.enlaceOrigen,
    };
  }
  const fallback = CATEGORY_IMAGES[post.categoria] ?? CATEGORY_IMAGES["como-llega-tu-mercancia"];
  if (!fallback || !esUrlDePortadaPermitida(fallback.src)) return null;
  return { src: fallback.src, alt: fallback.alt || post.title, credito: null, licencia: null, enlaceOrigen: null };
}

export function normalizeEditorialSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-VE")
    .trim();
}

export function matchesEditorialSearch(
  post: Pick<NewsPostRow, "title" | "excerpt" | "focus_keyword" | "secondary_keywords">,
  query: string,
) {
  const needle = normalizeEditorialSearch(query);
  if (!needle) return true;
  const haystack = normalizeEditorialSearch(
    [post.title, post.excerpt, post.focus_keyword ?? "", ...(post.secondary_keywords ?? [])].join(" "),
  );
  return haystack.includes(needle);
}

export function tipoToContentKind(tipo: NewsTipo): NewsContentKind {
  if (tipo === "polemica") return "analysis";
  if (tipo === "especial") return "news";
  return "guide";
}
