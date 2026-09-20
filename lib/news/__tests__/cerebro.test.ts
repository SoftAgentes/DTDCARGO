// @vitest-environment node
/**
 * Tests del cerebro clasificador (SDD-0089 · F-A).
 *
 * Cubre los criterios de aceptación de F-A:
 *  - Mapeo 8→4 (CEREBRO_A_EDITORIAL) cubre los 8 tipos del cerebro y los null
 *    (promo/pregunta/detras-camara) son exactamente los que NUNCA van a blog.
 *  - El mapeo SOLO produce tipos editoriales válidos (coherencia con categories.ts).
 *  - flujoFromScore: ≥3 ⇒ 'A', ≤2 ⇒ 'B' (la regla §5 del manual de comunicación).
 *  - scoreFromTest = suma de los 5 booleanos (la fuente de verdad del score,
 *    recalculada en server, no confiada al LLM).
 *  - Coherencia de la taxonomía: labels/descripciones no vacías, canales/ángulos.
 */

import { describe, it, expect } from "vitest";
import { ALL_TIPO_SLUGS, type NewsTipo } from "../categories";
import {
  CEREBRO_A_EDITORIAL,
  CEREBRO_TIPOS,
  ALL_CEREBRO_TIPOS,
  cerebroPuedeSerNoticia,
  flujoFromScore,
  scoreFromTest,
  TEST_NOTICIA_KEYS,
  TEST_NOTICIA_LABELS,
  ALL_CANALES,
  CANAL_LABELS,
  ALL_ANGULOS,
  ANGULO_LABELS,
  type CerebroTipo,
  type TestNoticiaKey,
} from "../cerebro";

// Los 8 tipos del cerebro (§3 del manual) con su mapeo editorial esperado.
const EXPECTED_MAP: Array<{ tipo: CerebroTipo; editorial: NewsTipo | null }> = [
  { tipo: "guia", editorial: "informativo" },
  { tipo: "postura", editorial: "polemica" },
  { tipo: "historia", editorial: "curiosidad" },
  { tipo: "dato", editorial: "informativo" },
  { tipo: "actualidad", editorial: "polemica" },
  { tipo: "promo", editorial: null },
  { tipo: "pregunta", editorial: null },
  { tipo: "detras-camara", editorial: null },
];

// Los 3 tipos que la regla §3 marca como "No" en la columna ¿Noticia?.
const SOLO_FLUJO_B: CerebroTipo[] = ["promo", "pregunta", "detras-camara"];

describe("CEREBRO_A_EDITORIAL — mapeo 8→4 (SDD-0089 F-A)", () => {
  it("tiene exactamente los 8 tipos del cerebro", () => {
    expect(ALL_CEREBRO_TIPOS).toHaveLength(8);
    expect(ALL_CEREBRO_TIPOS.sort()).toEqual(
      EXPECTED_MAP.map((e) => e.tipo).sort(),
    );
    expect(Object.keys(CEREBRO_A_EDITORIAL)).toHaveLength(8);
  });

  it("mapea cada uno de los 8 tipos al editorial esperado (cubre los 8)", () => {
    for (const { tipo, editorial } of EXPECTED_MAP) {
      expect(CEREBRO_A_EDITORIAL[tipo]).toBe(editorial);
    }
  });

  it("los null son EXACTAMENTE promo / pregunta / detras-camara", () => {
    const nullTipos = ALL_CEREBRO_TIPOS.filter(
      (t) => CEREBRO_A_EDITORIAL[t] === null,
    );
    expect(nullTipos.sort()).toEqual([...SOLO_FLUJO_B].sort());
  });

  it("todo editorial no-null es un NewsTipo válido (coherencia con categories.ts)", () => {
    for (const tipo of ALL_CEREBRO_TIPOS) {
      const editorial = CEREBRO_A_EDITORIAL[tipo];
      if (editorial !== null) {
        expect(ALL_TIPO_SLUGS).toContain(editorial);
      }
    }
  });

  it("cerebroPuedeSerNoticia es false solo para los 3 tipos sin editorial", () => {
    for (const tipo of ALL_CEREBRO_TIPOS) {
      const puede = cerebroPuedeSerNoticia(tipo);
      expect(puede).toBe(!SOLO_FLUJO_B.includes(tipo));
    }
  });

  it("cada tipo del cerebro tiene label + description no vacíos", () => {
    for (const tipo of ALL_CEREBRO_TIPOS) {
      const info = CEREBRO_TIPOS[tipo];
      expect(info.label.trim().length).toBeGreaterThan(0);
      expect(info.description.trim().length).toBeGreaterThan(0);
    }
  });
});

describe("flujoFromScore — la regla A/B (§5: 3+ SÍ = A)", () => {
  it("score >= 3 devuelve 'A'", () => {
    expect(flujoFromScore(3)).toBe("A");
    expect(flujoFromScore(4)).toBe("A");
    expect(flujoFromScore(5)).toBe("A");
  });

  it("score <= 2 devuelve 'B'", () => {
    expect(flujoFromScore(0)).toBe("B");
    expect(flujoFromScore(1)).toBe("B");
    expect(flujoFromScore(2)).toBe("B");
  });

  it("el umbral exacto está en 3 (frontera 2→B, 3→A)", () => {
    expect(flujoFromScore(2)).toBe("B");
    expect(flujoFromScore(3)).toBe("A");
  });
});

describe("scoreFromTest — suma de los 5 booleanos (fuente de verdad)", () => {
  const allFalse: Record<TestNoticiaKey, boolean> = {
    busca_google: false,
    ia_responde: false,
    sirve_6_meses: false,
    ensena_resuelve: false,
    parece_experto: false,
  };

  it("0 SÍ ⇒ score 0", () => {
    expect(scoreFromTest(allFalse)).toBe(0);
  });

  it("5 SÍ ⇒ score 5", () => {
    const allTrue = { ...allFalse };
    for (const k of TEST_NOTICIA_KEYS) allTrue[k] = true;
    expect(scoreFromTest(allTrue)).toBe(5);
  });

  it("cuenta exactamente cuántos true hay (3 ⇒ 3)", () => {
    const three: Record<TestNoticiaKey, boolean> = {
      ...allFalse,
      busca_google: true,
      ia_responde: true,
      ensena_resuelve: true,
    };
    expect(scoreFromTest(three)).toBe(3);
    // y ese score lleva a Flujo A
    expect(flujoFromScore(scoreFromTest(three))).toBe("A");
  });

  it("un solo true ⇒ score 1 ⇒ Flujo B", () => {
    const one: Record<TestNoticiaKey, boolean> = {
      ...allFalse,
      parece_experto: true,
    };
    expect(scoreFromTest(one)).toBe(1);
    expect(flujoFromScore(scoreFromTest(one))).toBe("B");
  });
});

describe("Test de Noticia — las 5 preguntas (§5)", () => {
  it("tiene exactamente las 5 claves del test", () => {
    expect(TEST_NOTICIA_KEYS).toHaveLength(5);
  });

  it("cada clave del test tiene su label humano", () => {
    for (const k of TEST_NOTICIA_KEYS) {
      expect(TEST_NOTICIA_LABELS[k]?.trim().length).toBeGreaterThan(0);
    }
  });
});

describe("Canales y ángulos — taxonomía (§7, §4)", () => {
  it("hay 4 canales con label, e incluye 'noticias' (blog)", () => {
    expect(ALL_CANALES).toHaveLength(4);
    expect(ALL_CANALES).toContain("noticias");
    for (const c of ALL_CANALES) {
      expect(CANAL_LABELS[c]?.trim().length).toBeGreaterThan(0);
    }
  });

  it("hay 6 ángulos con label (§4)", () => {
    expect(ALL_ANGULOS).toHaveLength(6);
    for (const a of ALL_ANGULOS) {
      expect(ANGULO_LABELS[a]?.trim().length).toBeGreaterThan(0);
    }
  });
});
