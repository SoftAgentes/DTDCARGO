/**
 * SDD-0289 · Los CSV de Clientes, Cobranzas y Tracking.
 *
 * Lo que se prueba es lo que puede mentirle a quien abre el archivo:
 *
 *  - Que las etiquetas sean las de la pantalla y no enums de Postgres.
 *  - Que los montos se puedan **sumar en Excel** (sin separador de miles).
 *  - Que "nunca se verificó" no se confunda con "no verificable".
 *  - Que el saldo nativo y el normalizado a USD viajen **separados**: sumar la
 *    columna multi-moneda daría un total inventado.
 */

import { describe, it, expect } from "vitest";
import {
  CLIENTES_CSV_HEADERS,
  COBRANZAS_CSV_HEADERS,
  TRACKING_CSV_HEADERS,
  buildClientesCsv,
  buildCobranzasCsv,
  buildTrackingCsv,
  clientesCsvFilename,
  cobranzasCsvFilename,
  trackingCsvFilename,
} from "../operativo-csv";
import type { Client } from "@/lib/studio/client-types";
import type { Receivable } from "@/lib/studio/payment-queries";
import type { ShipmentListRow } from "@/lib/studio/shipment-queries";

const BOM = "﻿";

/** Parte el CSV respetando comillas (los nombres de cliente llevan coma). */
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

function mkClient(over: Partial<Client> = {}): Client {
  return {
    id: "c1",
    tenant_id: "t1",
    markbox: "DTD-1234",
    name: "Importadora Ñandú, C.A.",
    email: "a@b.com",
    phone: "04121234567",
    address: "Valencia",
    rif: "J-123456789",
    contact_name: null,
    tier: "regular",
    notes: null,
    lat: null,
    lng: null,
    registration_channel: "admin",
    doc_kind: "empresa",
    doc_verify_status: null,
    doc_verify_source: null,
    doc_registry_name: null,
    doc_verified_at: null,
    created_at: "2026-08-01T10:00:00Z",
    ...over,
  } as Client;
}

function mkReceivable(over: Partial<Receivable> = {}): Receivable {
  return {
    invoice: {
      invoice_code: "F-2026-0001",
      client_name: "Importadora Ñandú, C.A.",
      client_markbox: "DTD-1234",
      shipment_code: "SHP-1",
      currency: "USD",
      issued_at: "2026-08-01",
      due_date: "2026-08-31",
    },
    balance: 2000,
    balanceUsd: 2000,
    daysOverdue: 5,
    stage: "vencido",
    promiseDate: null,
    ...over,
  } as Receivable;
}

function mkShipment(over: Partial<ShipmentListRow> = {}): ShipmentListRow {
  return {
    id: "s1",
    code: "SHP-2026-0007",
    client_name: "Importadora Ñandú, C.A.",
    client_markbox: "DTD-1234",
    origin: "Yiwu",
    destination: "Valencia",
    shipment_service: "consolidado_lcl",
    status: "in_transit",
    weight_kg: 820,
    volume_m3: 3.4,
    created_at: "2026-08-01T10:00:00Z",
    ...over,
  } as ShipmentListRow;
}

describe("buildClientesCsv", () => {
  it("respeta las cabeceras del contrato", () => {
    const f = filas(buildClientesCsv([mkClient()]));
    expect(f[0].join(",")).toBe(CLIENTES_CSV_HEADERS.join(","));
  });

  it("🔴 'sin verificar' NO es lo mismo que 'no verificable'", () => {
    // null = nunca se corrió la verificación. 'unavailable' = se corrió y el
    // registro oficial no respondió. Aplastarlas haría que el equipo dejara de
    // perseguir las que nunca se miraron.
    const i = CLIENTES_CSV_HEADERS.indexOf("verificacion");
    expect(filas(buildClientesCsv([mkClient()]))[1][i]).toBe("Sin verificar");
    expect(
      filas(buildClientesCsv([mkClient({ doc_verify_status: "unavailable" })]))[1][i],
    ).toBe("No verificable");
    expect(
      filas(buildClientesCsv([mkClient({ doc_verify_status: "mismatch" })]))[1][i],
    ).toBe("No coincide");
  });

  it("traduce el canal de alta y el tipo de documento", () => {
    const iCanal = CLIENTES_CSV_HEADERS.indexOf("origen_del_alta");
    const iDoc = CLIENTES_CSV_HEADERS.indexOf("tipo_documento");
    const f = filas(buildClientesCsv([mkClient({ registration_channel: "portal" })]));
    expect(f[1][iCanal]).toBe("Auto-registro");
    expect(f[1][iDoc]).toBe("RIF");
  });

  it("el nombre con ñ y coma sale entrecomillado y detrás del BOM", () => {
    const csv = buildClientesCsv([mkClient()]);
    expect(csv.startsWith(BOM)).toBe(true);
    expect(csv).toContain('"Importadora Ñandú, C.A."');
  });

  it("sin clientes deja sólo la cabecera", () => {
    expect(buildClientesCsv([])).toBe(BOM + CLIENTES_CSV_HEADERS.join(","));
  });
});

describe("buildCobranzasCsv", () => {
  it("respeta las cabeceras del contrato", () => {
    const f = filas(buildCobranzasCsv([mkReceivable()]));
    expect(f[0].join(",")).toBe(COBRANZAS_CSV_HEADERS.join(","));
  });

  it("🔴 el saldo nativo y el normalizado a USD van en columnas SEPARADAS", () => {
    // El nativo es multi-moneda: sumar esa columna da un total inventado. La de
    // USD es la que se puede totalizar, y por eso llevan nombres distintos.
    const iSaldo = COBRANZAS_CSV_HEADERS.indexOf("saldo");
    const iUsd = COBRANZAS_CSV_HEADERS.indexOf("saldo_usd");
    const f = filas(
      buildCobranzasCsv([
        mkReceivable({
          invoice: { ...mkReceivable().invoice, currency: "VES" },
          balance: 400000,
          balanceUsd: 1000,
        } as Receivable),
      ]),
    );
    expect(f[1][iSaldo]).toBe("400000.00");
    expect(f[1][iUsd]).toBe("1000.00");
  });

  it("los montos van sin separador de miles (Excel los suma)", () => {
    const csv = buildCobranzasCsv([mkReceivable({ balance: 2000, balanceUsd: 2000 })]);
    expect(csv).toContain("2000.00");
    expect(csv).not.toContain("2,000.00");
  });

  it("sin días de vencimiento la celda va vacía, no en 0", () => {
    // 0 significa "vence hoy". Vacío significa "no tiene fecha".
    const i = COBRANZAS_CSV_HEADERS.indexOf("dias_vencido");
    expect(filas(buildCobranzasCsv([mkReceivable({ daysOverdue: null })]))[1][i]).toBe("");
    expect(filas(buildCobranzasCsv([mkReceivable({ daysOverdue: 0 })]))[1][i]).toBe("0");
  });

  it("traduce la etapa a la etiqueta de pantalla, no al enum", () => {
    const i = COBRANZAS_CSV_HEADERS.indexOf("etapa");
    const f = filas(buildCobranzasCsv([mkReceivable()]));
    expect(f[1][i]).toBe("Vencido");

    // Y una etapa desconocida se imprime cruda en vez de inventar una etiqueta.
    const raro = filas(
      buildCobranzasCsv([mkReceivable({ stage: "en_disputa" } as never)]),
    );
    expect(raro[1][i]).toBe("en_disputa");
  });
});

describe("buildTrackingCsv", () => {
  it("respeta las cabeceras del contrato", () => {
    const f = filas(buildTrackingCsv([mkShipment()]));
    expect(f[0].join(",")).toBe(TRACKING_CSV_HEADERS.join(","));
  });

  it("no escupe enums crudos de estado ni de servicio", () => {
    const csv = buildTrackingCsv([mkShipment()]);
    expect(csv).not.toContain("in_transit");
    expect(csv).not.toContain("consolidado_lcl");
  });

  it("el CBM lleva tres decimales y el peso dos", () => {
    const iCbm = TRACKING_CSV_HEADERS.indexOf("cbm");
    const iKg = TRACKING_CSV_HEADERS.indexOf("peso_kg");
    const f = filas(buildTrackingCsv([mkShipment()]));
    expect(f[1][iCbm]).toBe("3.400");
    expect(f[1][iKg]).toBe("820.00");
  });

  it("sin medidas las celdas van vacías, no en cero", () => {
    const iCbm = TRACKING_CSV_HEADERS.indexOf("cbm");
    const iKg = TRACKING_CSV_HEADERS.indexOf("peso_kg");
    const f = filas(buildTrackingCsv([mkShipment({ volume_m3: null, weight_kg: null })]));
    expect(f[1][iCbm]).toBe("");
    expect(f[1][iKg]).toBe("");
  });
});

describe("nombres de archivo", () => {
  it("llevan la fecha para que dos descargas no se pisen", () => {
    expect(clientesCsvFilename("2026-08-24")).toBe("clientes-2026-08-24.csv");
    expect(cobranzasCsvFilename("2026-08-24")).toBe("cobranzas-2026-08-24.csv");
    expect(trackingCsvFilename("2026-08-24")).toBe("embarques-2026-08-24.csv");
  });
});
