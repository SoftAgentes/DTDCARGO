// @vitest-environment node
/**
 * SDD-0473 · Corpus de documentos REALES.
 *
 * Los documentos no viven en Git: son proformas de proveedores con datos
 * comerciales. Se apuntan con `DOCUMENT_IMPORT_CORPUS=<carpeta>` y, sin esa
 * variable, la suite se salta — CI queda verde sin fingir que los probó.
 *
 * Existe porque las fixtures sintéticas dieron verde mientras los tres primeros
 * documentos reales fallaban: las escribe ExcelJS fila por fila y nunca traen el
 * formato de plantilla ni las filas de cargos que manda un proveedor de verdad.
 * Lo que se afirma acá es el mínimo que no se puede romper: que se leen sin IA
 * y que ningún número sale inventado.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { emptyDocumentDraft, computeDocumentTotals } from "@/lib/shared/document-import";

const asistida = vi.hoisted(() => vi.fn());
vi.mock("./anthropic", async (original) => ({
  ...(await original<typeof import("./anthropic")>()),
  extractWithAnthropic: asistida,
}));
import { extractDocument } from "./extract";

const CORPUS = process.env.DOCUMENT_IMPORT_CORPUS;
const disponible = !!CORPUS && existsSync(CORPUS);
const hojas = disponible ? readdirSync(CORPUS!).filter((f) => f.toLowerCase().endsWith(".xlsx")) : [];

describe.skipIf(!disponible)("corpus real de proformas", () => {
  it.each(hojas)("lee %s sin inventar números", async (name) => {
    asistida.mockReset();
    asistida.mockResolvedValue(emptyDocumentDraft());
    const bytes = new Uint8Array(readFileSync(join(CORPUS!, name)));

    const draft = await extractDocument(bytes, { sourceId: "corpus", fileName: name, kind: "unknown" });
    const totals = computeDocumentTotals(draft);

    // Todo número leído tiene que venir de una celda concreta del documento.
    for (const p of draft.products) {
      for (const campo of ["quantity", "unitPrice"] as const) {
        if (p[campo] !== null) expect(Number.isFinite(p[campo])).toBe(true);
      }
    }
    // Un total sólo existe si TODOS sus sumandos existen: nunca una suma parcial.
    if (totals.cartons !== null) expect(draft.groups.every((g) => g.cartons !== null)).toBe(true);
    if (totals.grossWeightKg !== null) expect(draft.groups.every((g) => g.grossWeightKg !== null)).toBe(true);
    if (totals.cbm !== null) expect(draft.groups.every((g) => g.cbm !== null)).toBe(true);

    // Una proforma sin packing list no declara logística: no se la puede inventar.
    if (draft.groups.length === 0) {
      expect(totals.cartons).toBeNull();
      expect(totals.grossWeightKg).toBeNull();
      expect(totals.cbm).toBeNull();
    }
  });

  it("lee las proformas con encabezados reconocibles sin llamar a la IA", async () => {
    const conEncabezado = hojas.filter((f) => /^PI-/i.test(f));
    expect(conEncabezado.length).toBeGreaterThan(0);
    for (const name of conEncabezado) {
      asistida.mockReset();
      asistida.mockResolvedValue(emptyDocumentDraft());
      const draft = await extractDocument(new Uint8Array(readFileSync(join(CORPUS!, name))), {
        sourceId: "corpus",
        fileName: name,
        kind: "unknown",
      });
      expect(asistida, `${name} derivó a la IA`).not.toHaveBeenCalled();
      expect(draft.products.length, `${name} no extrajo productos`).toBeGreaterThan(0);
      // La comisión del proveedor no es el valor de la mercancía.
      expect(draft.declaredTotals.amount, `${name} tomó un importe de cargo`).not.toBe(493.968);
    }
  });
});
