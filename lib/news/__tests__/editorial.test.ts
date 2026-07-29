import { describe, expect, it } from "vitest";
import {
  articleSchemaTypeOf,
  contentKindOf,
  editorialImageOf,
  matchesEditorialSearch,
} from "../editorial";
import type { NewsPostRow } from "../types";
import { extractNewsHeadings } from "../markdown";

function post(overrides: Partial<NewsPostRow> = {}): NewsPostRow {
  return {
    id: "post-1",
    slug: "guia-rastreo",
    tipo: "informativo",
    categoria: "como-llega-tu-mercancia",
    title: "Cómo rastrear tu envío marítimo",
    excerpt: "Aprende a seguir tu carga desde China hasta Venezuela.",
    body_markdown: "## Primer paso",
    author_name: "DTD Cargo",
    author_role: null,
    focus_keyword: "rastrear carga",
    secondary_keywords: ["contenedor", "Shipping Mark"],
    meta_description: null,
    pain_points: [],
    date: "2026-07-22",
    read_time_min: 6,
    published: true,
    source: "manual",
    created_at: "2026-07-22T12:00:00Z",
    ...overrides,
  };
}

describe("clasificación editorial pública", () => {
  it("respeta content_kind cuando la columna ya existe", () => {
    expect(contentKindOf(post({ content_kind: "analysis" }))).toBe("analysis");
    expect(articleSchemaTypeOf(post({ content_kind: "analysis" }))).toBe("Article");
  });

  it("mantiene fallbacks compatibles antes de aplicar la migración editorial", () => {
    expect(contentKindOf(post())).toBe("guide");
    expect(articleSchemaTypeOf(post())).toBe("BlogPosting");
    expect(contentKindOf(post({ categoria: "novedades-dtd" }))).toBe("news");
    expect(articleSchemaTypeOf(post({ categoria: "novedades-dtd" }))).toBe("NewsArticle");
    expect(contentKindOf(post({ categoria: "historias-reales" }))).toBe("case");
  });
});

describe("índice del artículo", () => {
  it("genera anclas estables y diferencia encabezados repetidos", () => {
    expect(extractNewsHeadings("## Qué necesitas\n\n### Documentos\n\n## Qué necesitas")).toEqual([
      { id: "que-necesitas", text: "Qué necesitas", level: 2 },
      { id: "documentos", text: "Documentos", level: 3 },
      { id: "que-necesitas-2", text: "Qué necesitas", level: 2 },
    ]);
  });
});

describe("búsqueda y fotografía editorial", () => {
  it("busca sin distinguir mayúsculas ni acentos", () => {
    expect(matchesEditorialSearch(post(), "COMO RASTREAR")).toBe(true);
    expect(matchesEditorialSearch(post(), "shipping mark")).toBe(true);
    expect(matchesEditorialSearch(post(), "impuestos")).toBe(false);
  });

  it("usa una foto operativa local y rechaza hosts externos no aprobados", () => {
    expect(editorialImageOf(post()).src).toMatch(/^\/fotos\//);
    expect(editorialImageOf(post({ cover_image_url: "https://example.com/foto.jpg" })).src).toMatch(/^\/fotos\//);
    expect(editorialImageOf(post({ cover_image_url: "/fotos/propia.jpg" })).src).toBe("/fotos/propia.jpg");
  });
});
