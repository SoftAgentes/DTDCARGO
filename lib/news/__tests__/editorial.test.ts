import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ALL_CATEGORIA_SLUGS } from "../categories";
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

  it("usa el respaldo propio y rechaza hosts externos o portadas sin licencia", () => {
    expect(editorialImageOf(post())?.src).toMatch(/^\/fotos\//);
    // Sin licencia registrada la portada propia no cuenta, sea ruta local o URL externa.
    expect(editorialImageOf(post({ cover_image_url: "https://example.com/foto.jpg" }))?.src).toMatch(/^\/fotos\/dtd-cargo/);
    expect(editorialImageOf(post({ cover_image_url: "/fotos/propia.jpg" }))?.src).not.toBe("/fotos/propia.jpg");
    // Con licencia y URL permitida sí.
    const con = editorialImageOf(post({ cover_image_url: "/fotos/dtd-cargo-camion-entrega.webp", cover_license: "Foto propia" }));
    expect(con?.src).toBe("/fotos/dtd-cargo-camion-entrega.webp");
    expect(con?.licencia).toBe("Foto propia");
    // Con licencia, pero de la marca anterior o de un host ajeno: respaldo.
    expect(editorialImageOf(post({ cover_image_url: "/fotos/doortudoor.jpg", cover_license: "Propia" }))?.src).not.toMatch(/doortudoor/);
    expect(editorialImageOf(post({ cover_image_url: "https://otro.example/a.jpg", cover_license: "CC0" }))?.src).not.toMatch(/otro\.example/);
  });

  it("los respaldos son solo fotos revisadas a la vista (sin las excluidas ni las dudosas de §11.5)", () => {
    const usados = new Set(ALL_CATEGORIA_SLUGS.map((categoria) => editorialImageOf(post({ categoria }))?.src));
    for (const fuera of [
      "precinto-doortudoor", "carga-contenedor-precinto-doortudoor", "puerto-venezuela-aduana-entrega-final",
      "dtd-cargo-recepcion-contenedor", "dtd-cargo-descarga-bodega", "dtd-cargo-atencion-mapa",
    ]) {
      for (const src of usados) expect(src, fuera).not.toContain(fuera);
    }
  });

  it("ningún respaldo por categoría usa fotos de la marca anterior y todos existen", () => {
    for (const categoria of ALL_CATEGORIA_SLUGS) {
      const imagen = editorialImageOf(post({ categoria }));
      expect(imagen).not.toBeNull();
      const src = imagen!.src;
      expect(src.toLowerCase()).not.toMatch(/doortudoor|door-to-door|doortodoor/);
      expect(existsSync(join(process.cwd(), "public", src))).toBe(true);
    }
  });
});
