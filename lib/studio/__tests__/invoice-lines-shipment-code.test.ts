/**
 * SDD-0555 · El borrador conserva el embarque de cada línea (hallazgo FAC-08).
 *
 * El cargador de consolidados (SDD-0543) crea un borrador por cliente y
 * contenedor con una línea por embarque, cada una con su `shipmentCode`: el
 * Portal lista con eso los embarques de la factura y suma su medida. Editar el
 * borrador en el Studio pasaba por tres lugares que soltaban el código (la
 * lectura `coerce`, el drawer y `normalizeLines` al guardar), así que una
 * corrección de precio le borraba al Portal la lista y la medida sumada.
 *
 * Cada `describe` fija uno de esos lugares; el último recorre el camino
 * completo como lo hace la app: leer → drawer → JSON del form → server action.
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

/** Fila de `invoices` como la deja el cargador de 0543: dos embarques + exceso. */
const LINEAS_DEL_CARGADOR = [
  { desc: "Flete DDP · ENV-PRUEBA-01 · 1.5 m³ × $100", qty: 1.5, unitPrice: 100, shipmentCode: "ENV-PRUEBA-01" },
  { desc: "Flete DDP · ENV-PRUEBA-02 · 2 m³ × $100", qty: 2, unitPrice: 100, shipmentCode: "ENV-PRUEBA-02" },
  { desc: "Exceso de peso", qty: 1, unitPrice: 30 },
];

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
  base_amount: "380",
  iva_amount: "0",
  total_amount: "380",
  status: "borrador",
  issued_at: null,
  due_date: null,
  paid_amount: "0",
  last_payment_at: null,
  lines: LINEAS_DEL_CARGADOR,
  notes: null,
  created_at: "2026-10-18T00:00:00Z",
  updated_at: "2026-10-18T00:00:00Z",
  deleted_at: null,
};

/** Doble mínimo de `getInvoiceByCode`: devuelve la fila si el código coincide. */
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
      data: codigo === fila.invoice_code ? fila : null,
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
  it("cada línea trae su shipmentCode; la que no tiene, no lo lleva", async () => {
    const inv = await getInvoiceByCode(stubPorCodigo(FILA), "F-2026-0555");
    expect(inv?.lines).toEqual(LINEAS_DEL_CARGADOR);
    expect(inv?.lines[2]).not.toHaveProperty("shipmentCode");
  });
});

describe("linesToDraft / draftToLines (el drawer)", () => {
  it("ida y vuelta sin tocar nada conserva los códigos", () => {
    expect(draftToLines(linesToDraft(LINEAS_DEL_CARGADOR))).toEqual(LINEAS_DEL_CARGADOR);
  });

  it("editar descripción o precio no suelta el código; una línea nueva no lo inventa", () => {
    const draft = linesToDraft(LINEAS_DEL_CARGADOR);
    draft[0] = { ...draft[0], desc: "Flete DDP corregido", unitPrice: "90" };
    draft.push({ desc: "Seguro", qty: "1", unitPrice: "12" });
    const lines = draftToLines(draft);
    expect(lines[0]).toEqual({ desc: "Flete DDP corregido", qty: 1.5, unitPrice: 90, shipmentCode: "ENV-PRUEBA-01" });
    expect(lines[1].shipmentCode).toBe("ENV-PRUEBA-02");
    expect(lines[3]).toEqual({ desc: "Seguro", qty: 1, unitPrice: 12 });
  });

  it("sin líneas, el drawer arranca con una vacía y sin código", () => {
    expect(linesToDraft([])).toEqual([{ desc: "", qty: "1", unitPrice: "" }]);
  });
});

describe("FAC-08 · editar el borrador de varios embarques", () => {
  it("leer → drawer → form → server action deja los dos embarques para el Portal", async () => {
    // 1. El Studio abre el borrador (page.tsx → getInvoiceByCode).
    const inv = await getInvoiceByCode(stubPorCodigo(FILA), "F-2026-0555");
    expect(inv).not.toBeNull();

    // 2. El operador corrige un precio en el drawer.
    const draft = linesToDraft(inv!.lines);
    draft[1] = { ...draft[1], unitPrice: "95" };

    // 3. El drawer serializa al input oculto `lines`; la action lo parsea
    //    (parseLines → normalizeLines) y lo valida (validateInvoiceInput).
    const json = JSON.stringify(draftToLines(draft));
    const { input, fieldErrors } = validateInvoiceInput({
      client_markbox: inv!.client_markbox,
      client_name: inv!.client_name,
      currency: "USD",
      lines: normalizeLines(JSON.parse(json)),
    });
    expect(fieldErrors).toBeUndefined();

    // 4. Lo que se persiste en `invoices.lines` sigue nombrando los embarques.
    expect(codigosComoElPortal(input!.lines)).toEqual(["ENV-PRUEBA-01", "ENV-PRUEBA-02"]);
    expect(input!.lines[1]).toEqual({
      desc: "Flete DDP · ENV-PRUEBA-02 · 2 m³ × $100",
      qty: 2,
      unitPrice: 95,
      shipmentCode: "ENV-PRUEBA-02",
    });
  });
});
