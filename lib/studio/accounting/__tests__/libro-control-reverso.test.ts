/**
 * SDD-0573 · El cruce de documentos contra asientos con el contra-asiento de la
 * 0497. Al anular una factura, su asiento de venta queda `asentado` (en un
 * período cerrado no se toca) y nace su reverso (`invoice_reversal`, con
 * `reverses_entry_id`). El par suma cero: para el cruce, el original cuenta como
 * anulado. Sin esto, cada factura anulada saldría como «anulada con asiento
 * vivo», que es justo lo que la 0497 corrige (B1).
 */
import { describe, expect, it } from "vitest";
import {
  asientosRevertidos,
  cruzarDocumentosConAsientos,
  type AsientoDeDocumento,
  type DocumentoContable,
} from "../libro-control";

const factura = (id: string, vivo: boolean): DocumentoContable => ({
  tipo: "factura",
  id,
  codigo: `F-${id}`,
  fecha: "2026-10-01",
  moneda: "USD",
  monto: 100,
  vivo,
});
const asiento = (id: string, extra: Partial<AsientoDeDocumento>): AsientoDeDocumento => ({
  id,
  status: "asentado",
  source: "invoice",
  deleted_at: null,
  invoice_id: null,
  receipt_id: null,
  bill_id: null,
  supplier_payment_id: null,
  ...extra,
});

describe("asientosRevertidos", () => {
  it("son los que tienen un contra-asiento vivo", () => {
    const set = asientosRevertidos([
      asiento("e1", { invoice_id: "f1" }),
      asiento("r1", { source: "invoice_reversal", invoice_id: "f1", reverses_entry_id: "e1" }),
      // Un reverso anulado o borrado no revierte nada.
      asiento("e2", { invoice_id: "f2" }),
      asiento("r2", { source: "invoice_reversal", invoice_id: "f2", reverses_entry_id: "e2", status: "anulado" }),
      asiento("e3", { invoice_id: "f3" }),
      asiento("r3", { source: "invoice_reversal", invoice_id: "f3", reverses_entry_id: "e3", deleted_at: "2026-10-20" }),
      // Solo un invoice_reversal revierte.
      asiento("x", { source: "manual", reverses_entry_id: "e3" }),
    ]);
    expect([...set]).toEqual(["e1"]);
  });
});

describe("cruzarDocumentosConAsientos · con el contra-asiento", () => {
  it("una factura anulada con su reverso no sale como «anulada con asiento vivo»", () => {
    const r = cruzarDocumentosConAsientos(
      [factura("f1", false)],
      [
        asiento("e1", { invoice_id: "f1" }),
        asiento("r1", { source: "invoice_reversal", invoice_id: "f1", reverses_entry_id: "e1" }),
      ],
    );
    expect(r.anuladosConAsiento).toEqual([]);
    expect(r.conteo.factura.anuladosConAsiento).toBe(0);
  });

  it("una anulada SIN reverso sigue saliendo (es la de antes de la 0497)", () => {
    const r = cruzarDocumentosConAsientos([factura("f1", false)], [asiento("e1", { invoice_id: "f1" })]);
    expect(r.anuladosConAsiento.map((h) => h.codigo)).toEqual(["F-f1"]);
  });

  it("una viva cuyo asiento tiene reverso queda sin asiento vivo (motivo asiento anulado)", () => {
    const r = cruzarDocumentosConAsientos(
      [factura("f1", true)],
      [
        asiento("e1", { invoice_id: "f1" }),
        asiento("r1", { source: "invoice_reversal", invoice_id: "f1", reverses_entry_id: "e1" }),
      ],
    );
    expect(r.sinAsiento.map((h) => [h.codigo, h.motivo])).toEqual([["F-f1", "asiento_anulado"]]);
  });

  it("el reverso no cuenta como un asiento de venta de la factura", () => {
    const r = cruzarDocumentosConAsientos(
      [factura("f1", true)],
      [asiento("r1", { source: "invoice_reversal", invoice_id: "f1", reverses_entry_id: "e-otro" })],
    );
    expect(r.sinAsiento.map((h) => [h.codigo, h.motivo])).toEqual([["F-f1", "sin_asiento"]]);
  });
});

describe("el libro diario nombra el reverso", () => {
  it("«Reverso de factura», y el rótulo del origen del libro de control lo usa", async () => {
    const { entrySourceLabel } = await import("../../journal-types");
    const { origenDelAsiento } = await import("../libro-control");
    expect(entrySourceLabel("invoice_reversal")).toBe("Reverso de factura");
    expect(origenDelAsiento("invoice_reversal")).toBe("Reverso de factura");
  });
});
