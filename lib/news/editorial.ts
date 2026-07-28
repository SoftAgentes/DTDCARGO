import type { NewsCategoria, NewsTipo } from "./categories";
import type { NewsContentKind, NewsPostRow } from "./types";

export const CONTENT_KIND_LABELS: Record<NewsContentKind, string> = {
  guide: "Guía",
  news: "Noticia",
  analysis: "Análisis",
  case: "Caso real",
};

const CATEGORY_IMAGES: Record<NewsCategoria, { src: string; alt: string }> = {
  "importa-sin-perder-plata": {
    src: "/fotos/carga-contenedor-precinto-doortudoor-dtd-cargo-puerta-a-puerta-china-venezuela.jpg",
    alt: "Carga de DTD Cargo preparada para envío marítimo",
  },
  "que-se-mueve-en-china": {
    src: "/fotos/bodega-yiwu-china-recepcion-consolidacion-dtd-cargo.jpg",
    alt: "Operación de recepción y consolidación de DTD Cargo en Yiwu",
  },
  "como-llega-tu-mercancia": {
    src: "/fotos/precinto-doortudoor-contenedor-dtd-cargo-puerta-a-puerta-china-venezuela.jpg",
    alt: "Contenedor de DTD Cargo identificado para su tránsito marítimo",
  },
  "venezuela-y-tu-bolsillo": {
    src: "/fotos/puerto-venezuela-aduana-entrega-final-dtd-cargo.jpg",
    alt: "Operación portuaria y entrega de carga en Venezuela",
  },
  "historias-reales": {
    src: "/fotos/carga-contenedor-precinto-doortudoor-dtd-cargo-puerta-a-puerta-china-venezuela.jpg",
    alt: "Mercancía de clientes durante una operación de DTD Cargo",
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

export function editorialImageOf(
  post: Pick<NewsPostRow, "cover_image_url" | "cover_alt" | "categoria" | "title">,
) {
  const fallback = CATEGORY_IMAGES[post.categoria] ?? CATEGORY_IMAGES["como-llega-tu-mercancia"];
  const customSrc = post.cover_image_url?.trim();
  return {
    // Hasta definir una allowlist de hosts en next.config, solo aceptamos assets
    // locales versionados. Una URL externa nunca rompe la portada.
    src: customSrc?.startsWith("/") ? customSrc : fallback.src,
    alt: post.cover_alt?.trim() || fallback.alt || post.title,
  };
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
