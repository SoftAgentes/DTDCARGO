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
  asientosPorDocumento,
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
  tenant_id: "tenant-control",
  status: "asentado",
  source: "invoice",
  deleted_at: null,
  invoice_id: null,
  receipt_id: null,
  bill_id: null,
  supplier_payment_id: null,
  reverses_entry_id: null,
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

/**
 * GO1 I2 · la presencia de un UUID no certifica un par íntegro.
 * Estas negativas puras no certifican B1, tenant/ACL SQL ni locks.
 */
describe("GO1 I2 · sólo un vínculo coherente permite considerar revertido", () => {
  it.each([
    { nombre: "factura distinta", extra: { invoice_id: "f-ajena" } },
    { nombre: "factura ausente", extra: { invoice_id: null } },
    { nombre: "original borrador", extra: { status: "borrador" } },
    { nombre: "original borrado", extra: { deleted_at: "2026-10-20" } },
  ])("$nombre no se oculta por un reverso vivo", ({ nombre, extra }) => {
    const cambiaOriginal = nombre.startsWith("original");
    const original = asiento("e-go1", { invoice_id: "f-go1", ...(cambiaOriginal ? extra : {}) });
    const reverso = asiento("r-go1", {
      invoice_id: "f-go1", source: "invoice_reversal", reverses_entry_id: "e-go1",
      ...(!cambiaOriginal ? extra : {}),
    });

    expect([...asientosRevertidos([original, reverso])]).toEqual([]);
  });

  it("un original ausente es vínculo no comprobado, no reverso válido", () => {
    const reverso = asiento("r-go1", {
      invoice_id: "f-go1", source: "invoice_reversal", reverses_entry_id: "fuera-del-conjunto",
    });

    expect([...asientosRevertidos([reverso])]).toEqual([]);
    // La recuperación del otro extremo fuera de filtro/página es tarea del
    // lector pendiente; este helper no puede certificar su existencia.
  });

  it("tenant distinto no permite validar el par aunque factura y UUID coincidan", () => {
    const original = { ...asiento("e-go1", { invoice_id: "f-go1" }), tenant_id: "tenant-a-go1" };
    const reverso = {
      ...asiento("r-go1", { invoice_id: "f-go1", source: "invoice_reversal", reverses_entry_id: "e-go1" }),
      tenant_id: "tenant-b-go1",
    };

    expect([...asientosRevertidos([original, reverso])]).toEqual([]);
  });

  it("una factura anulada conserva su hallazgo si el reverso apunta a otra factura", () => {
    const r = cruzarDocumentosConAsientos(
      [factura("f-go1", false)],
      [
        asiento("e-go1", { invoice_id: "f-go1" }),
        asiento("r-go1", { invoice_id: "f-ajena", source: "invoice_reversal", reverses_entry_id: "e-go1" }),
      ],
    );

    expect(r.anuladosConAsiento.map((h) => h.codigo)).toEqual(["F-f-go1"]);
    expect(r.conteo.factura.anuladosConAsiento).toBe(1);
  });
});

describe("T03 · evidencia de cabeceras, sin certificación financiera", () => {
  const par = () => [
    asiento("original", { invoice_id: "f1" }),
    asiento("reverso", { invoice_id: "f1", source: "invoice_reversal", reverses_entry_id: "original" }),
  ];

  it.each([
    { nombre: "borrado original", lado: 0, campo: "deleted_at" },
    { nombre: "borrado reverso", lado: 1, campo: "deleted_at" },
    { nombre: "tenant original", lado: 0, campo: "tenant_id" },
    { nombre: "tenant reverso", lado: 1, campo: "tenant_id" },
    { nombre: "factura original", lado: 0, campo: "invoice_id" },
    { nombre: "factura reverso", lado: 1, campo: "invoice_id" },
    { nombre: "backlink original", lado: 0, campo: "reverses_entry_id" },
    { nombre: "backlink reverso", lado: 1, campo: "reverses_entry_id" },
  ])("$nombre ausente no equivale a metadata conocida", ({ lado, campo }) => {
    const entradas = par();
    // Omitir después del constructor: sus defaults no reparan el sujeto.
    delete (entradas[lado] as unknown as Record<string, unknown>)[campo];
    expect([...asientosRevertidos(entradas)]).toEqual([]);
  });

  it.each([
    { nombre: "tenant numérico original", lado: 0, cambio: { tenant_id: 7 } },
    { nombre: "tenant objeto reverso", lado: 1, cambio: { tenant_id: {} } },
    { nombre: "tenant vacío original", lado: 0, cambio: { tenant_id: "" } },
    { nombre: "tenant blanco reverso", lado: 1, cambio: { tenant_id: " " } },
    { nombre: "factura numérica original", lado: 0, cambio: { invoice_id: 7 } },
    { nombre: "factura objeto reverso", lado: 1, cambio: { invoice_id: {} } },
    { nombre: "factura vacía original", lado: 0, cambio: { invoice_id: "" } },
    { nombre: "factura vacía reverso", lado: 1, cambio: { invoice_id: "" } },
    { nombre: "borrado false original", lado: 0, cambio: { deleted_at: false } },
    { nombre: "borrado cero reverso", lado: 1, cambio: { deleted_at: 0 } },
    { nombre: "backlink false original", lado: 0, cambio: { reverses_entry_id: false } },
    { nombre: "backlink numérico reverso", lado: 1, cambio: { reverses_entry_id: 7 } },
    { nombre: "ID numérico original", lado: 0, cambio: { id: 7 } },
    { nombre: "ID objeto reverso", lado: 1, cambio: { id: {} } },
  ])("$nombre inválido no se convierte en identidad o null válido", ({ lado, cambio }) => {
    const entradas = par();
    Object.assign(entradas[lado], cambio);
    expect([...asientosRevertidos(entradas)]).toEqual([]);
  });

  it("un reverso que se apunta a sí mismo no oculta la venta", () => {
    const entradas = par();
    entradas[1].reverses_entry_id = "reverso";
    const cruce = cruzarDocumentosConAsientos([factura("f1", false)], entradas);
    expect([...asientosRevertidos(entradas)]).toEqual([]);
    expect(cruce.anuladosConAsiento.map(h => h.codigo)).toEqual(["F-f1"]);
  });

  it("una cadena con backlink en el original no acredita un par simple", () => {
    const entradas = par();
    entradas[0].reverses_entry_id = "anterior";
    entradas.push(asiento("anterior", { invoice_id: "f1" }));
    expect([...asientosRevertidos(entradas)]).toEqual([]);
  });

  it("duplicados exactos y orden opuesto conservan un solo par sin exigir UUID ni líneas", () => {
    const entradas = par();
    const duplicadas = [entradas[0], { ...entradas[1] }, { ...entradas[0] }, entradas[1]];
    for (const leidas of [duplicadas, [...duplicadas].reverse()]) {
      expect([...asientosRevertidos(leidas)]).toEqual(["original"]);
      expect(cruzarDocumentosConAsientos([factura("f1", false)], leidas).anuladosConAsiento).toEqual([]);
    }
  });

  it.each([0, 1])("metadata contradictoria del extremo %s conserva el hallazgo en ambos órdenes", lado => {
    for (const cambio of [{ tenant_id: "otro" }, { invoice_id: "otra" }, { status: "anulado" },
      { deleted_at: "2026-10-20" }, { reverses_entry_id: "otro-original" }]) {
      const entradas = par();
      entradas.push({ ...entradas[lado], ...cambio });
      for (const leidas of [entradas, [...entradas].reverse()]) {
        expect([...asientosRevertidos(leidas)]).toEqual([]);
        const docs = [factura("f1", false)];
        const cruce = cruzarDocumentosConAsientos(docs, leidas);
        expect(asientosPorDocumento(docs, leidas).get("factura:f1")).toEqual({ vivos: 1, anulados: 0 });
        expect(cruce.anuladosConAsiento.map(h => h.codigo)).toEqual(["F-f1"]);
        expect(cruce.conteo.factura.anuladosConAsiento).toBe(1);
      }
    }
  });

  it("dos reversos vivos elegibles no se resuelven eligiendo una fila", () => {
    const entradas = par();
    entradas.push({ ...entradas[1], id: "segundo-reverso" });
    for (const leidas of [entradas, [...entradas].reverse()]) {
      expect([...asientosRevertidos(leidas)]).toEqual([]);
      expect(cruzarDocumentosConAsientos([factura("f1", false)], leidas).anuladosConAsiento.map(h => h.codigo)).toEqual(["F-f1"]);
    }
  });

  it("un reverso anulado adicional no convierte un par único en dos elegibles", () => {
    const entradas = par();
    entradas.push({ ...entradas[1], id: "reverso-anulado", status: "anulado" });
    expect([...asientosRevertidos(entradas)]).toEqual(["original"]);
  });

  it("la prioridad de presencia no traslada el invoice vivo observado de otra factura", () => {
    const entradas = [asiento("id-compartido", { invoice_id: "f1", status: "anulado" }),
      asiento("id-compartido", { invoice_id: "f2" })];
    const docs = [factura("f1", false), factura("f2", false)];
    for (const leidas of [entradas, [...entradas].reverse()]) {
      expect([...asientosRevertidos(leidas)]).toEqual([]);
      const conteo = asientosPorDocumento(docs, leidas);
      expect(conteo.get("factura:f1")).toEqual({ vivos: 0, anulados: 1 });
      expect(conteo.get("factura:f2")).toEqual({ vivos: 1, anulados: 0 });
      expect(cruzarDocumentosConAsientos(docs, leidas).anuladosConAsiento.map(h => h.codigo)).toEqual(["F-f2"]);
    }
  });
});
