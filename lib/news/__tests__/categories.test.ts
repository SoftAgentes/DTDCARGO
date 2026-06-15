/**
 * Tests de la taxonomía de negocio de news (SDD-0087 · F1).
 *
 * Cubre los criterios de aceptación de F1:
 *  - 6 categorías de negocio (reemplazan las 10 técnicas), con sus tipos editoriales.
 *  - Helpers (categoriasByTipo, ALL_*, gradientToCss) consistentes con la nueva taxonomía.
 *  - Gradients usan SOLO hex de la paleta de marca existente (cero hex inventados).
 *  - Paridad de claves entre categories.ts ↔ seo-keywords.ts (PAIN_POINTS_BY_CATEGORIA).
 *  - Paridad código ↔ migración 0139: el CHECK de la DB acota a exactamente estos 6 slugs,
 *    y el re-mapeo cubre las 10 categorías técnicas viejas.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import {
  NEWS_CATEGORIES_V4,
  NEWS_TIPOS,
  ALL_CATEGORIA_SLUGS,
  ALL_TIPO_SLUGS,
  categoriasByTipo,
  gradientToCss,
  getCategoryInfo,
  type NewsCategoria,
  type NewsTipo,
} from "../categories";
import { PAIN_POINTS_BY_CATEGORIA } from "../seo-keywords";

// Slugs esperados (las 6 de negocio del founder) + su tipo editorial.
const EXPECTED: Array<{ slug: NewsCategoria; tipo: NewsTipo }> = [
  { slug: "importa-sin-perder-plata", tipo: "informativo" },
  { slug: "que-se-mueve-en-china", tipo: "curiosidad" },
  { slug: "como-llega-tu-mercancia", tipo: "informativo" },
  { slug: "venezuela-y-tu-bolsillo", tipo: "polemica" },
  { slug: "historias-reales", tipo: "curiosidad" },
  { slug: "novedades-dtd", tipo: "especial" },
];

// Paleta de marca permitida (la ya presente en el archivo original).
const BRAND_HEX = new Set([
  "#0F1E3D",
  "#7F0F1A",
  "#5E0A12",
  "#1F8A5B",
  "#C2353F",
  "#B8893A",
  "#333333",
  "#C2747F",
]);

describe("NEWS_CATEGORIES_V4 — 6 categorías de negocio (SDD-0087 F1)", () => {
  it("tiene exactamente las 6 categorías de negocio", () => {
    expect(ALL_CATEGORIA_SLUGS.sort()).toEqual(EXPECTED.map((e) => e.slug).sort());
    expect(Object.keys(NEWS_CATEGORIES_V4)).toHaveLength(6);
  });

  it("ya NO contiene ninguna de las 10 categorías técnicas viejas", () => {
    const viejas = [
      "operaciones",
      "tarifas-fletes",
      "aduana-seniat",
      "tutoriales-guias",
      "china",
      "industria-global",
      "casos-reales",
      "analisis-opinion",
      "mitos-realidades",
      "anuncios-dtd",
    ];
    for (const v of viejas) {
      expect(ALL_CATEGORIA_SLUGS).not.toContain(v);
    }
  });

  it("asigna el tipo editorial correcto a cada categoría", () => {
    for (const { slug, tipo } of EXPECTED) {
      expect(NEWS_CATEGORIES_V4[slug].tipo).toBe(tipo);
    }
  });

  it("la categoría motor es 'importa-sin-perder-plata' y es informativo", () => {
    expect(NEWS_CATEGORIES_V4["importa-sin-perder-plata"].label).toBe(
      "Importa sin perder plata",
    );
    expect(NEWS_CATEGORIES_V4["importa-sin-perder-plata"].tipo).toBe("informativo");
  });

  it("cada categoría tiene label, titlePrefix y description no vacíos", () => {
    for (const slug of ALL_CATEGORIA_SLUGS) {
      const info = NEWS_CATEGORIES_V4[slug];
      expect(info.label.trim().length).toBeGreaterThan(0);
      expect(info.titlePrefix.trim().length).toBeGreaterThan(0);
      expect(info.description.trim().length).toBeGreaterThan(0);
    }
  });

  it("todos los gradients usan SOLO hex de la paleta de marca (cero hex inventados)", () => {
    for (const slug of ALL_CATEGORIA_SLUGS) {
      const { from, to } = NEWS_CATEGORIES_V4[slug].gradient;
      expect(BRAND_HEX.has(from), `${slug}.from=${from}`).toBe(true);
      expect(BRAND_HEX.has(to), `${slug}.to=${to}`).toBe(true);
    }
  });
});

describe("Tipos editoriales — sin cambios (4)", () => {
  it("conserva los 4 tipos editoriales", () => {
    expect(ALL_TIPO_SLUGS.sort()).toEqual(
      ["curiosidad", "especial", "informativo", "polemica"].sort(),
    );
    expect(Object.keys(NEWS_TIPOS)).toHaveLength(4);
  });

  it("cada tipo editorial tiene al menos una categoría", () => {
    for (const tipo of ALL_TIPO_SLUGS) {
      expect(categoriasByTipo(tipo).length).toBeGreaterThan(0);
    }
  });

  it("categoriasByTipo solo devuelve categorías del tipo pedido", () => {
    for (const tipo of ALL_TIPO_SLUGS) {
      for (const slug of categoriasByTipo(tipo)) {
        expect(NEWS_CATEGORIES_V4[slug].tipo).toBe(tipo);
      }
    }
  });
});

describe("gradientToCss", () => {
  it("emite linear-gradient 135deg con from/to", () => {
    expect(gradientToCss({ from: "#0F1E3D", to: "#1F8A5B" })).toBe(
      "linear-gradient(135deg, #0F1E3D 0%, #1F8A5B 100%)",
    );
  });
});

describe("PAIN_POINTS_BY_CATEGORIA — paridad con la taxonomía", () => {
  it("tiene exactamente las mismas 6 claves que NEWS_CATEGORIES_V4", () => {
    expect(Object.keys(PAIN_POINTS_BY_CATEGORIA).sort()).toEqual(
      [...ALL_CATEGORIA_SLUGS].sort(),
    );
  });

  it("cada categoría informativa/polémica/curiosidad de dolor tiene ≥1 pain point; 'novedades-dtd' va vacía", () => {
    for (const slug of ALL_CATEGORIA_SLUGS) {
      const pains = PAIN_POINTS_BY_CATEGORIA[slug];
      if (slug === "novedades-dtd") {
        expect(pains).toHaveLength(0);
      } else {
        expect(pains.length).toBeGreaterThan(0);
      }
    }
  });
});

describe("Paridad código ↔ migración 0139", () => {
  const sql = readFileSync(
    join(process.cwd(), "supabase", "migrations", "0139_news_categorias_negocio.sql"),
    "utf8",
  );

  it("el CHECK nuevo lista exactamente los 6 slugs de negocio", () => {
    const m = sql.match(/check\s*\(categoria in \(([^)]*)\)\)/i);
    expect(m, "no se encontró el CHECK de categoria en 0139").toBeTruthy();
    const slugsEnCheck = (m![1].match(/'([^']+)'/g) ?? []).map((s) =>
      s.replace(/'/g, ""),
    );
    expect(slugsEnCheck.sort()).toEqual([...ALL_CATEGORIA_SLUGS].sort());
  });

  it("el re-mapeo (UPDATE … SET categoria) cubre las 10 categorías técnicas viejas como origen", () => {
    const origenes = [...sql.matchAll(/where categoria::text = '([^']+)'/gi)].map(
      (mm) => mm[1],
    );
    const viejas = [
      "operaciones",
      "tarifas-fletes",
      "aduana-seniat",
      "tutoriales-guias",
      "china",
      "industria-global",
      "casos-reales",
      "analisis-opinion",
      "mitos-realidades",
      "anuncios-dtd",
    ];
    expect(new Set(origenes)).toEqual(new Set(viejas));
  });

  it("todos los destinos del re-mapeo son slugs de negocio válidos", () => {
    const destinos = [
      ...sql.matchAll(/set categoria = '([^']+)'\s+where categoria::text/gi),
    ].map((mm) => mm[1]);
    expect(destinos.length).toBe(10);
    for (const d of destinos) {
      expect(ALL_CATEGORIA_SLUGS).toContain(d as NewsCategoria);
    }
  });

  it("el UPDATE aparece ANTES del nuevo CHECK (orden seguro)", () => {
    const idxUpdate = sql.search(/update public\.news_posts set categoria/i);
    const idxCheck = sql.search(/add constraint news_posts_categoria_check/i);
    expect(idxUpdate).toBeGreaterThan(-1);
    expect(idxCheck).toBeGreaterThan(-1);
    expect(idxUpdate).toBeLessThan(idxCheck);
  });
});

describe("getCategoryInfo — fallback seguro (blinda /noticias ante slugs legacy)", () => {
  it("devuelve la entrada real para un slug de negocio válido", () => {
    expect(getCategoryInfo("importa-sin-perder-plata")).toBe(
      NEWS_CATEGORIES_V4["importa-sin-perder-plata"],
    );
  });

  it("devuelve un fallback DEFINIDO (no undefined) para una categoría legacy de la DB", () => {
    // 'industria-global' es una de las 10 viejas: sigue en prod hasta aplicar 0139.
    // Sin fallback, NEWS_CATEGORIES_V4['industria-global'] sería undefined → crash.
    const cat = getCategoryInfo("industria-global");
    expect(cat).toBeDefined();
    expect(cat.label.trim().length).toBeGreaterThan(0);
    expect(typeof cat.gradient.from).toBe("string");
    expect(typeof cat.gradient.to).toBe("string");
  });

  it("el gradient del fallback usa SOLO hex de la paleta de marca", () => {
    const cat = getCategoryInfo("slug-inexistente-cualquiera");
    expect(BRAND_HEX.has(cat.gradient.from)).toBe(true);
    expect(BRAND_HEX.has(cat.gradient.to)).toBe(true);
  });
});
