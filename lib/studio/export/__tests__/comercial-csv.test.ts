// @vitest-environment node
/**
 * SDD-0281 · Los CSV del carril comercial.
 *
 * Lo que se prueba es que el archivo diga lo MISMO que la pantalla: etiquetas
 * en español (no enums de Postgres), el saldo y el vencimiento derivados con
 * los mismos helpers que pinta la UI, y el BOM que evita que Excel en Windows
 * destroce los acentos de los nombres de cliente.
 */

import { describe, it, expect } from "vitest";
import { buildCsv, csvCell } from "../csv";
import {
  ESTIMADOS_CSV_HEADERS,
  FACTURAS_CSV_HEADERS,
  buildEstimadosCsv,
  buildFacturasCsv,
  estimadosCsvFilename,
  facturasCsvFilename,
} from "../comercial-csv";
import type { Invoice } from "@/lib/studio/invoice-types";
import type { Quote } from "@/lib/studio/quote-types";

const BOM = "﻿";

function mkQuote(over: Partial<Quote> = {}): Quote {
  return {
    id: "q1",
    tenant_id: "t1",
    quote_code: "EST-2026-0001",
    client_markbox: "DTD-1234",
    client_name: "Importadora Ñandú, C.A.",
    service: "consolidado_lcl",
    origin: "Yiwu",
    destination: "Puerto Cabello",
    cbm: 3.4,
    weight_kg: 820,
    boxes: 12,
    packaging: "ninguno",
    rate_per_cbm: 800,
    flat_rate: null,
    rate_used_id: null,
    subtotal_usd: 2720,
    packaging_cost: 0,
    total_usd: 2720,
    status: "sent",
    valid_until: "2026-09-01",
    sent_at: null,
    accepted_at: null,
    converted_to_shipment_id: null,
    sales_order_id: null,
    notes: null,
    prospect_name: null,
    prospect_email: null,
    prospect_whatsapp: null,
    nota: null,
    source: "studio",
    created_at: "2026-08-01T10:00:00Z",
    updated_at: "2026-08-01T10:00:00Z",
    deleted_at: null,
    ...over,
  } as Quote;
}

function mkInvoice(over: Partial<Invoice> = {}): Invoice {
  return {
    id: "i1",
    tenant_id: "t1",
    invoice_code: "F-2026-0001",
    client_markbox: "DTD-1234",
    client_name: "Importadora Ñandú, C.A.",
    shipment_id: null,
    shipment_code: "SHP-2026-0007",
    currency: "USD",
    fx_rate: null,
    iva_rate: 0,
    iva_mode: null,
    base_amount: 2720,
    iva_amount: 0,
    total_amount: 2720,
    status: "emitida",
    issued_at: "2026-08-01",
    due_date: "2026-08-31",
    paid_amount: 0,
    last_payment_at: null,
    lines: [{ desc: "Flete", qty: 3.4, unitPrice: 800 }],
    notes: null,
    created_at: "2026-08-01T10:00:00Z",
    updated_at: "2026-08-01T10:00:00Z",
    deleted_at: null,
    ...over,
  } as Invoice;
}

/**
 * Parte el CSV en filas y celdas, respetando comillas (RFC 4180).
 *
 * ⚠️ Un `split(",")` a secas NO sirve y no es un detalle del test: los nombres
 * de cliente reales llevan coma ("Importadora Ñandú, C.A."), la celda sale
 * entrecomillada, y el split parte la fila de más y corre todas las columnas.
 * El primer intento de este archivo hacía justamente eso y daba cinco fallos
 * que parecían del código y eran del test.
 */
function filas(csv: string): string[][] {
  const out: string[][] = [];
  let fila: string[] = [];
  let celda = "";
  let enComillas = false;

  const texto = csv.startsWith(BOM) ? csv.slice(1) : csv;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (enComillas) {
      if (c === '"') {
        if (texto[i + 1] === '"') {
          celda += '"';
          i++;
        } else enComillas = false;
      } else celda += c;
      continue;
    }
    if (c === '"') enComillas = true;
    else if (c === ",") {
      fila.push(celda);
      celda = "";
    } else if (c === "\r" && texto[i + 1] === "\n") {
      fila.push(celda);
      out.push(fila);
      fila = [];
      celda = "";
      i++;
    } else celda += c;
  }
  fila.push(celda);
  out.push(fila);
  return out;
}

describe("primitiva csv", () => {
  it("entrecomilla sólo cuando hace falta y duplica las comillas internas", () => {
    expect(csvCell("simple")).toBe("simple");
    expect(csvCell("con, coma")).toBe('"con, coma"');
    expect(csvCell('dice "hola"')).toBe('"dice ""hola"""');
    expect(csvCell("salto\nlínea")).toBe('"salto\nlínea"');
    expect(csvCell(null)).toBe("");
    expect(csvCell(0)).toBe("0");
  });

  it("el documento arranca con BOM y separa filas con CRLF", () => {
    const csv = buildCsv(["a", "b"], [["1", "2"]]);
    expect(csv.startsWith(BOM)).toBe(true);
    expect(csv).toBe(`${BOM}a,b\r\n1,2`);
  });
});

describe("buildEstimadosCsv", () => {
  it("respeta las cabeceras del contrato y una fila por estimado", () => {
    const csv = buildEstimadosCsv([mkQuote(), mkQuote({ quote_code: "EST-2026-0002" })]);
    const f = filas(csv);
    expect(f[0].join(",")).toBe(ESTIMADOS_CSV_HEADERS.join(","));
    expect(f).toHaveLength(3);
  });

  it("traduce estado y servicio a lo que el usuario lee en pantalla", () => {
    const csv = buildEstimadosCsv([mkQuote({ status: "accepted" })]);
    expect(csv).not.toContain("accepted");
    expect(csv).not.toContain("consolidado_lcl");
    expect(csv).toContain("Aceptada");
  });

  it("el nombre con ñ viaja intacto y detrás del BOM", () => {
    const csv = buildEstimadosCsv([mkQuote()]);
    expect(csv.startsWith(BOM)).toBe(true);
    // El nombre lleva coma, así que además tiene que salir entrecomillado.
    expect(csv).toContain('"Importadora Ñandú, C.A."');
  });

  it("distingue el null del cero: sin tarifa fija la celda va vacía", () => {
    const f = filas(buildEstimadosCsv([mkQuote({ flat_rate: null, packaging_cost: 0 })]));
    const i = ESTIMADOS_CSV_HEADERS.indexOf("tarifa_fija");
    const j = ESTIMADOS_CSV_HEADERS.indexOf("costo_embalaje_usd");
    expect(f[1][i]).toBe("");
    expect(f[1][j]).toBe("0.00");
  });

  it("dice SI/NO en vez de escupir el uuid del embarque", () => {
    const i = ESTIMADOS_CSV_HEADERS.indexOf("convertido_a_embarque");
    const conv = filas(buildEstimadosCsv([mkQuote({ converted_to_shipment_id: "uuid-1" })]));
    const sin = filas(buildEstimadosCsv([mkQuote()]));
    expect(conv[1][i]).toBe("Sí");
    expect(sin[1][i]).toBe("No");
    expect(conv.join("")).not.toContain("uuid-1");
  });

  it("marca de dónde salió el estimado (calculadora web vs Studio)", () => {
    const i = ESTIMADOS_CSV_HEADERS.indexOf("origen_del_estimado");
    expect(filas(buildEstimadosCsv([mkQuote({ source: "web" })]))[1][i]).toBe(
      "Calculadora web",
    );
    expect(filas(buildEstimadosCsv([mkQuote()]))[1][i]).toBe("Studio");
  });

  it("sin estimados deja el archivo con sólo la cabecera (no vacío)", () => {
    expect(buildEstimadosCsv([])).toBe(BOM + ESTIMADOS_CSV_HEADERS.join(","));
  });
});

describe("buildFacturasCsv", () => {
  it("respeta las cabeceras del contrato", () => {
    const f = filas(buildFacturasCsv([mkInvoice()]));
    expect(f[0].join(",")).toBe(FACTURAS_CSV_HEADERS.join(","));
  });

  it("calcula el saldo, no lo lee de una columna que no existe", () => {
    const i = FACTURAS_CSV_HEADERS.indexOf("saldo");
    const f = filas(buildFacturasCsv([mkInvoice({ total_amount: 2720, paid_amount: 720 })]));
    expect(f[1][i]).toBe("2000.00");
  });

  it("🔴 los montos van SIN separador de miles, para que Excel los sume", () => {
    // `fmtAmount` daría "2,720.00" y Excel lee esa celda como TEXTO: la columna
    // deja de poderse sumar, que es para lo que alguien baja este archivo.
    // (Y de paso la coma obligaría a entrecomillar cada monto.)
    const csv = buildFacturasCsv([mkInvoice({ total_amount: 2720 })]);
    expect(csv).toContain("2720.00");
    expect(csv).not.toContain("2,720.00");
  });

  it("🔴 `vencida` es columna aparte y NO pisa el estado real", () => {
    // La DB guarda `emitida`; el vencimiento se deriva de la fecha. Aplastarlos
    // en una celda perdería el estado con el que la factura vive en el sistema.
    const iEstado = FACTURAS_CSV_HEADERS.indexOf("estado");
    const iVenc = FACTURAS_CSV_HEADERS.indexOf("vencida");
    const f = filas(
      buildFacturasCsv([mkInvoice({ status: "emitida", due_date: "2020-01-01" })]),
    );
    expect(f[1][iEstado]).toBe("Emitida");
    expect(f[1][iVenc]).toBe("Sí");
  });

  it("una factura pagada nunca sale como vencida aunque la fecha pasó", () => {
    const iVenc = FACTURAS_CSV_HEADERS.indexOf("vencida");
    const f = filas(
      buildFacturasCsv([
        mkInvoice({ status: "pagada", due_date: "2020-01-01", paid_amount: 2720 }),
      ]),
    );
    expect(f[1][iVenc]).toBe("No");
  });

  it("no escupe enums crudos de Postgres", () => {
    const csv = buildFacturasCsv([mkInvoice({ status: "anulada" })]);
    expect(csv).toContain("Anulada");
    expect(csv).not.toContain("anulada,");
  });
});

describe("nombres de archivo", () => {
  it("llevan la fecha para que dos descargas no se pisen", () => {
    expect(estimadosCsvFilename("2026-08-23")).toBe("estimados-2026-08-23.csv");
    expect(facturasCsvFilename("2026-08-23")).toBe("facturas-2026-08-23.csv");
  });
});
