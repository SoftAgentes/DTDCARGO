// @vitest-environment node
/**
 * Tests de la comparación de nombres / razón social (SDD-0046 · Slice A).
 *
 * Cubre criterios de Acceptance §Slice A:
 *  - normalizeName: acentos (Ñ→N), sufijos societarios (C.A./S.A./COMPAÑIA ANONIMA),
 *    orden de tokens irrelevante.
 *  - compareNames: igual → ok · claramente distinto → mismatch · acentos → ok ·
 *    nombre extendido / casada / 2º apellido → ok (umbral conservador documentado).
 */

import { describe, it, expect } from "vitest";
import {
  normalizeName,
  compareNames,
  NAME_MATCH_THRESHOLD,
} from "../name-match";

describe("normalizeName", () => {
  it("quita acentos y pasa a mayúsculas (Ñ → N)", () => {
    expect(normalizeName("José Núñez")).toBe("JOSE NUNEZ");
  });

  it("ordena los tokens alfabéticamente (orden nombre/apellido no importa)", () => {
    expect(normalizeName("María Acosta")).toBe(normalizeName("Acosta María"));
    expect(normalizeName("María Acosta")).toBe("ACOSTA MARIA");
  });

  it("remueve el sufijo societario C.A.", () => {
    expect(normalizeName("ACME C.A.")).toBe("ACME");
    expect(normalizeName("Acme S.A.")).toBe("ACME");
  });

  it("remueve la frase societaria 'COMPAÑIA ANONIMA'", () => {
    expect(normalizeName("ACME COMPAÑIA ANONIMA")).toBe("ACME");
  });

  it("remueve S.R.L.", () => {
    expect(normalizeName("Logística Express S.R.L.")).toBe("EXPRESS LOGISTICA");
  });

  it("colapsa separadores (comas, espacios múltiples)", () => {
    expect(normalizeName("Acosta,   María")).toBe("ACOSTA MARIA");
  });

  it("null / vacío → string vacío", () => {
    expect(normalizeName(null)).toBe("");
    expect(normalizeName("")).toBe("");
    expect(normalizeName("   ")).toBe("");
  });

  it("no devuelve vacío si el nombre era puro ruido societario", () => {
    // "C.A." sola: tras filtrar quedaría vacío; preservamos el token crudo.
    expect(normalizeName("C.A.")).not.toBe("");
  });
});

describe("compareNames", () => {
  it("nombres idénticos → ok, score 1", () => {
    const r = compareNames("María Acosta", "Maria Acosta");
    expect(r.verdict).toBe("ok");
    expect(r.score).toBeCloseTo(1, 5);
  });

  it("mismo nombre con orden invertido → ok", () => {
    const r = compareNames("Acosta María", "María Acosta");
    expect(r.verdict).toBe("ok");
    expect(r.score).toBeCloseTo(1, 5);
  });

  it("acentos / Ñ no cambian el veredicto → ok", () => {
    const r = compareNames("José Núñez", "JOSE NUNEZ");
    expect(r.verdict).toBe("ok");
    expect(r.score).toBeCloseTo(1, 5);
  });

  it("razón social con C.A. matchea sin C.A. → ok", () => {
    const r = compareNames("ACME C.A.", "Acme");
    expect(r.verdict).toBe("ok");
  });

  it("nombres claramente distintos → mismatch", () => {
    const r = compareNames("María Pérez", "Pedro Gómez");
    expect(r.verdict).toBe("mismatch");
    expect(r.score).toBeLessThan(NAME_MATCH_THRESHOLD);
  });

  it("'MARIA PEREZ' vs 'MARIA J PEREZ GOMEZ' → ok (nombre extendido, borderline documentado)", () => {
    // tokens A={MARIA,PEREZ} ⊆ B={GOMEZ,J,MARIA,PEREZ} → rescate por subconjunto.
    const r = compareNames("MARIA PEREZ", "MARIA J PEREZ GOMEZ");
    expect(r.verdict).toBe("ok");
    expect(r.score).toBeCloseTo(0.5, 5);
  });

  it("apellido de casada / 2º apellido (subconjunto) → ok aunque baje el Jaccard", () => {
    // {GARCIA,JOSE} ⊆ {DE,GARCIA,JOSE,LUIS,PEREZ,RODRIGUEZ} → ok por rescate.
    const r = compareNames(
      "Jose Garcia",
      "Jose Luis Garcia Rodriguez de Perez",
    );
    expect(r.verdict).toBe("ok");
  });

  it("comparte solo un apellido sin ser subconjunto → mismatch (divergencia real)", () => {
    // {JUAN,PEREZ} vs {MARIA,PEREZ}: inter=1 union=3 → 0.33 < umbral, no subconjunto.
    const r = compareNames("Juan Perez", "Maria Perez");
    expect(r.verdict).toBe("mismatch");
  });

  it("falta un lado (sin nombre del registro) → ok, score 0 (no afirma divergencia)", () => {
    expect(compareNames("María Acosta", null)).toEqual({
      score: 0,
      verdict: "ok",
    });
    expect(compareNames("", "Maria Acosta")).toEqual({
      score: 0,
      verdict: "ok",
    });
  });

  it("el umbral es conservador (bajo) por diseño advisory", () => {
    expect(NAME_MATCH_THRESHOLD).toBeLessThan(0.5);
  });
});
