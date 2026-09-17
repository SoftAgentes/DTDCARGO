/**
 * Tests del allowlist de origen del alta (SDD-0474).
 *
 * Lo que protegen: `normalizarOrigen` es lo único que separa el querystring
 * público de `clients.registration_channel`, una columna del ERP **sin CHECK**
 * (migr 0092). Si el allowlist se abre, cualquiera escribe lo que quiera ahí
 * pasando `?origen=` y el reporte por canal deja de valer.
 */
import { describe, it, expect } from "vitest";
import {
  normalizarOrigen,
  ORIGEN_DEFAULT,
  ORIGENES_PERMITIDOS,
} from "../registro-origen";

describe("normalizarOrigen", () => {
  it("acepta cada origen del allowlist tal cual", () => {
    for (const o of ORIGENES_PERMITIDOS) {
      expect(normalizarOrigen(o)).toBe(o);
    }
  });

  it("normaliza la forma: espacios, mayúsculas y guion bajo", () => {
    expect(normalizarOrigen("  guia-alibaba  ")).toBe("guia-alibaba");
    expect(normalizarOrigen("GUIA-ALIBABA")).toBe("guia-alibaba");
    expect(normalizarOrigen("guia_alibaba")).toBe("guia-alibaba");
    expect(normalizarOrigen("Academia")).toBe("academia");
  });

  it("cae al default con lo que no reconoce", () => {
    for (const malo of [
      "instagram",
      "guia-alibaba-falsa",
      "admin", // el canal del alta por Studio NO se declara desde la web
      "'; drop table clients; --",
      "guia alibaba", // el espacio no se convierte en guion: no es el valor
      "",
      "   ",
    ]) {
      expect(normalizarOrigen(malo)).toBe(ORIGEN_DEFAULT);
    }
  });

  it("cae al default sin valor o con tipo inesperado", () => {
    expect(normalizarOrigen(undefined)).toBe(ORIGEN_DEFAULT);
    expect(normalizarOrigen(null)).toBe(ORIGEN_DEFAULT);
    // searchParams de Next entrega array cuando el param se repite.
    expect(normalizarOrigen([])).toBe(ORIGEN_DEFAULT);
    expect(normalizarOrigen(["academia", "guia-alibaba"])).toBe("academia");
  });

  it("no se deja desbordar por un valor larguísimo", () => {
    expect(normalizarOrigen("a".repeat(5000))).toBe(ORIGEN_DEFAULT);
    // Un permitido con basura pegada tampoco pasa: el corte no lo rescata.
    expect(normalizarOrigen("academia" + "x".repeat(5000))).toBe(ORIGEN_DEFAULT);
  });

  it("el default es un valor del allowlist (si no, el fallback escribiría basura)", () => {
    expect(ORIGENES_PERMITIDOS).toContain(ORIGEN_DEFAULT);
  });

  it("'portal' sigue siendo el default, que es lo que escribía SDD-0046", () => {
    expect(ORIGEN_DEFAULT).toBe("portal");
  });
});
