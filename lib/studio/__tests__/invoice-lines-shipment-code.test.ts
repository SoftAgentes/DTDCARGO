/**
 * SDD-0555 · El borrador conserva el embarque de cada línea (hallazgo FAC-08).
 *
 * El cargador de consolidados (SDD-0543) crea un borrador por cliente y
 * contenedor con una línea por embarque, más las de exceso de peso, y TODAS
 * llevan su `shipmentCode` (`scripts/consolidados/lote-sql.ts`, `modelo.ts`):
 * el Portal lista con eso los embarques de la factura y suma su medida. Editar
 * el borrador en el Studio pasaba por tres lugares que soltaban el código (la
 * lectura `coerce`, el drawer y `normalizeLines` al guardar), así que una
 * corrección de precio le borraba al Portal la lista y la medida sumada.
 *
 * Aquí se prueban las funciones puras de esos tres lugares y su encadenado. El
 * drawer montado y la server action tienen sus propias pruebas
 * (`InvoiceDrawer.conserva-embarque.test.tsx`, `update-invoice-conserva-embarque.test.ts`).
 *
 * `toEqual` no distingue una clave ausente de una con `undefined`: donde importa
 * que una línea sin código no reciba la clave, se afirma con `toHaveProperty`.
 */
import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getInvoiceByCode } from "../invoice-queries";
import {
  draftToLines,
  lineShipmentCode,
  linesToDraft,
  normalizeLines,
  validateInvoiceInput,
  type InvoiceLine,
} from "../invoice-types";

/** Líneas como las escribe el cargador: dos embarques y un exceso del primero. */
const LINEAS_DEL_CARGADOR = [
  { desc: "Flete DDP · ENV-PRUEBA-01 · 1.5 m³ × $100", qty: 1.5, unitPrice: 100, shipmentCode: "ENV-PRUEBA-01" },
  { desc: "Flete DDP · ENV-PRUEBA-02 · 2 m³ × $100", qty: 2, unitPrice: 100, shipmentCode: "ENV-PRUEBA-02" },
  { desc: "Exceso de peso · ENV-PRUEBA-01 · cajas · 30 kg × $1", qty: 30, unitPrice: 1, shipmentCode: "ENV-PRUEBA-01" },
];

/** Una línea que el operador agregó a mano en el Studio: no tiene embarque. */
const LINEA_A_MANO = { desc: "Seguro", qty: 1, unitPrice: 12 };

/** El borrador del cargador después de que el operador le agregó el seguro. */
const LINEAS_DEL_BORRADOR = [...LINEAS_DEL_CARGADOR, LINEA_A_MANO];

const FILA = {
  id: "inv-0555",
  tenant_id: "t1",
  invoice_code: "F-2026-0555",
  client_markbox: "DTD-1001",
  client_name: "Cliente de prueba",
  client_rif: null,
  client_doc_kind: null,
  shipment_id: null,
  shipment_code: "ENV-PRUEBA-01",
  currency: "USD",
  fx_rate: null,
  iva_rate: "0",
  iva_mode: null,
  base_amount: "392",
  iva_amount: "0",
  total_amount: "392",
  status: "borrador",
  issued_at: null,
  due_date: null,
  paid_amount: "0",
  last_payment_at: null,
  lines: LINEAS_DEL_BORRADOR,
  notes: null,
  created_at: "2026-10-18T00:00:00Z",
  updated_at: "2026-10-18T00:00:00Z",
  deleted_at: null,
};

/**
 * Doble mínimo de `getInvoiceByCode`: devuelve la fila si el código coincide.
 * Entrega una copia profunda, como PostgREST, para que `coerce` no pueda
 * «conservar» el código por compartir objetos con el fixture.
 */
function stubPorCodigo(fila: Record<string, unknown>): SupabaseClient {
  let codigo: unknown;
  const q = {
    select: () => q,
    eq: (col: string, val: unknown) => {
      if (col === "invoice_code") codigo = val;
      return q;
    },
    is: () => q,
    maybeSingle: async () => ({
      data: codigo === fila.invoice_code ? structuredClone(fila) : null,
      error: null,
    }),
  };
  return { from: () => q } as unknown as SupabaseClient;
}

/** Los códigos como los junta el Portal (`embarquesDeLasLineas`, 0543). */
function codigosComoElPortal(lines: InvoiceLine[]): string[] {
  const codes: string[] = [];
  for (const l of lines) {
    const code = String(l.shipmentCode ?? "").trim();
    if (code && !codes.includes(code)) codes.push(code);
  }
  return codes;
}

describe("lineShipmentCode", () => {
  it("recorta el código y devuelve undefined si no hay texto", () => {
    expect(lineShipmentCode("  ENV-PRUEBA-01 ")).toBe("ENV-PRUEBA-01");
    expect(lineShipmentCode("")).toBeUndefined();
    expect(lineShipmentCode("   ")).toBeUndefined();
    expect(lineShipmentCode(null)).toBeUndefined();
    expect(lineShipmentCode(42)).toBeUndefined();
  });
});

describe("normalizeLines (al guardar)", () => {
  it("conserva el shipmentCode de cada línea, recortado", () => {
    expect(
      normalizeLines([
        { desc: "Flete A", qty: 1, unitPrice: 10, shipmentCode: " ENV-PRUEBA-01 " },
        { desc: "Flete B", qty: 1, unitPrice: 10, shipmentCode: "ENV-PRUEBA-02" },
      ]),
    ).toEqual([
      { desc: "Flete A", qty: 1, unitPrice: 10, shipmentCode: "ENV-PRUEBA-01" },
      { desc: "Flete B", qty: 1, unitPrice: 10, shipmentCode: "ENV-PRUEBA-02" },
    ]);
  });

  it("una línea sin código (vacío, en blanco o no texto) no inventa la clave", () => {
    const out = normalizeLines([
      { desc: "Exceso", qty: 1, unitPrice: 5 },
      { desc: "Vacío", qty: 1, unitPrice: 5, shipmentCode: "" },
      { desc: "Blanco", qty: 1, unitPrice: 5, shipmentCode: "   " },
      { desc: "Número", qty: 1, unitPrice: 5, shipmentCode: 7 },
    ]);
    expect(out).toHaveLength(4);
    for (const l of out) expect(l).not.toHaveProperty("shipmentCode");
  });
});

describe("getInvoiceByCode (al leer)", () => {
  it("cada línea trae su shipmentCode; la agregada a mano no lo lleva", async () => {
    const inv = await getInvoiceByCode(stubPorCodigo(FILA), "F-2026-0555");
    expect(inv?.lines).toEqual(LINEAS_DEL_BORRADOR);
    expect(inv?.lines[3]).not.toHaveProperty("shipmentCode");
  });
});

describe("linesToDraft / draftToLines (el drawer)", () => {
  it("ida y vuelta sin tocar nada conserva los códigos", () => {
    const draft = linesToDraft(LINEAS_DEL_BORRADOR);
    expect(draft.map((d) => d.shipmentCode)).toEqual([
      "ENV-PRUEBA-01",
      "ENV-PRUEBA-02",
      "ENV-PRUEBA-01",
      undefined,
    ]);
    expect(draft[3]).not.toHaveProperty("shipmentCode");

    const back = draftToLines(draft);
    expect(back).toEqual(LINEAS_DEL_BORRADOR);
    expect(back[3]).not.toHaveProperty("shipmentCode");
  });

  it("editar descripción o precio no suelta el código; una línea nueva no lo inventa", () => {
    const draft = linesToDraft(LINEAS_DEL_CARGADOR);
    draft[0] = { ...draft[0], desc: "Flete DDP corregido", unitPrice: "90" };
    draft.push({ desc: "Seguro", qty: "1", unitPrice: "12" });
    const lines = draftToLines(draft);
    expect(lines[0]).toEqual({ desc: "Flete DDP corregido", qty: 1.5, unitPrice: 90, shipmentCode: "ENV-PRUEBA-01" });
    expect(lines[1].shipmentCode).toBe("ENV-PRUEBA-02");
    expect(lines[2].shipmentCode).toBe("ENV-PRUEBA-01");
    expect(lines[3]).toEqual({ desc: "Seguro", qty: 1, unitPrice: 12 });
    expect(lines[3]).not.toHaveProperty("shipmentCode");
  });

  it("sin líneas, el drawer arranca con una vacía y sin código", () => {
    const draft = linesToDraft([]);
    expect(draft).toEqual([{ desc: "", qty: "1", unitPrice: "" }]);
    expect(draft[0]).not.toHaveProperty("shipmentCode");
  });
});

describe("FAC-08 · encadenado de las funciones puras", () => {
  it("leer → draft → JSON → normalizar → validar deja los dos embarques para el Portal", async () => {
    // 1. Lectura (page.tsx → getInvoiceByCode → coerce).
    const inv = await getInvoiceByCode(stubPorCodigo(FILA), "F-2026-0555");
    expect(inv).not.toBeNull();

    // 2. El operador corrige el precio del segundo embarque.
    const draft = linesToDraft(inv!.lines);
    draft[1] = { ...draft[1], unitPrice: "95" };

    // 3. Lo que el drawer pone en el input `lines` y lo que la action valida
    //    (`parseLines` es `normalizeLines(JSON.parse(raw))`; `validateInvoiceInput`
    //    vuelve a normalizar).
    const json = JSON.stringify(draftToLines(draft));
    const { input, fieldErrors } = validateInvoiceInput({
      client_markbox: inv!.client_markbox,
      client_name: inv!.client_name,
      currency: "USD",
      lines: normalizeLines(JSON.parse(json)),
    });
    expect(fieldErrors).toBeUndefined();

    // 4. El exceso del primer embarque no suma un tercer embarque.
    expect(codigosComoElPortal(input!.lines)).toEqual(["ENV-PRUEBA-01", "ENV-PRUEBA-02"]);
    expect(input!.lines.map((l) => l.shipmentCode)).toEqual([
      "ENV-PRUEBA-01",
      "ENV-PRUEBA-02",
      "ENV-PRUEBA-01",
      undefined,
    ]);
    expect(input!.lines[1]).toEqual({
      desc: "Flete DDP · ENV-PRUEBA-02 · 2 m³ × $100",
      qty: 2,
      unitPrice: 95,
      shipmentCode: "ENV-PRUEBA-02",
    });
    expect(input!.lines[3]).not.toHaveProperty("shipmentCode");
  });
});
