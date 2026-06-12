/**
 * Tests del builder del recibo de cobranza (SDD-0068 · decisión #6).
 *
 * El recibo es copy LEGAL con efecto probatorio: estos tests fijan el texto
 * STRING-EXACTO contra la plantilla de docs/legal/COPY_LEGAL_UI.md §2 —
 * leyenda de mandato, "NO constituye factura fiscal", "Recibido por:
 * Inversiones DTD Services, C.A. …" (BRAND-CHECK documentado en el spec),
 * pagador tercero con relación, versión del Acuerdo con fallbacks — y
 * verifican la regla absoluta del handoff: CERO "DoorTuDoor Trading" /
 * J-50220185 en el documento.
 */

import { describe, it, expect } from "vitest";
import {
  ACUERDO_DOC_KEY,
  buildReceiptDoc,
  normalizeAcuerdoVersion,
  pickAcuerdoVersion,
  RECEIPT_MANDATE_LEGEND,
  RECEIPT_NOT_FISCAL,
  RECEIPT_PENDING_REF,
  RECEIPT_RECEIVED_BY,
  RECEIPT_SERVICE_LINE,
  RECEIPT_TITLE,
  type ReceiptTemplateReceipt,
} from "../receipt-template";

function receipt(
  partial: Partial<ReceiptTemplateReceipt> = {},
): ReceiptTemplateReceipt {
  return {
    receipt_code: "R-2026-0042",
    client_name: "Comercial Pérez, C.A.",
    client_markbox: "DTD-5452",
    amount: 1250,
    currency: "USD",
    method: "transferencia",
    received_at: "2026-06-01",
    payer_kind: "cliente",
    payer_name: null,
    payer_relation: null,
    application_status: "aplicado",
    ...partial,
  };
}

// ── Texto completo STRING-EXACTO vs COPY §2 ───────────────────
describe("buildReceiptDoc · plantilla COPY §2 literal", () => {
  it("recibo con pagador TERCERO — documento completo, línea por línea", () => {
    const doc = buildReceiptDoc({
      receipt: receipt({
        payer_kind: "tercero",
        payer_name: "María Pérez",
        payer_relation: "familiar",
      }),
      invoice: {
        invoice_code: "F-2026-0031",
        shipment_code: "DTD-5452-3",
        client_markbox: "DTD-5452",
      },
      acuerdoVersion: "v2.1",
    });

    expect(doc.text).toBe(
      [
        "RECIBO DE PAGO — DTD CARGO",
        "Gestión de cobranza por cuenta de DTD Cargo (operadora internacional)",
        "Servicio puerta a puerta China–Venezuela",
        "",
        "Ref. envío: DTD-5452-3",
        "Cliente: Comercial Pérez, C.A.",
        "Pagador: María Pérez (tercero — relación: familiar)",
        "Monto: 1,250.00 USD   ·   Canal: Transferencia",
        "Fecha de recepción de fondos: 2026-06-01",
        "Recibido por: Inversiones DTD Services, C.A., agente de cobranza de la Operadora.",
        "",
        "Este recibo acredita la recepción del pago indicado y NO constituye factura fiscal.",
        "Documento sujeto al Acuerdo de Servicios v2.1 aceptado por el Cliente.",
      ].join("\n"),
    );
  });

  it("las constantes literales del COPY §2 no driftean", () => {
    expect(RECEIPT_TITLE).toBe("RECIBO DE PAGO — DTD CARGO");
    expect(RECEIPT_MANDATE_LEGEND).toBe(
      "Gestión de cobranza por cuenta de DTD Cargo (operadora internacional)",
    );
    expect(RECEIPT_SERVICE_LINE).toBe("Servicio puerta a puerta China–Venezuela");
    expect(RECEIPT_RECEIVED_BY).toBe(
      "Recibido por: Inversiones DTD Services, C.A., agente de cobranza de la Operadora.",
    );
    expect(RECEIPT_NOT_FISCAL).toBe(
      "Este recibo acredita la recepción del pago indicado y NO constituye factura fiscal.",
    );
  });

  it("pagador = el propio cliente imprime el nombre del cliente (sin relación)", () => {
    const doc = buildReceiptDoc({
      receipt: receipt(),
      invoice: {
        invoice_code: "F-2026-0031",
        shipment_code: "DTD-5452-3",
        client_markbox: "DTD-5452",
      },
      acuerdoVersion: "v2.1",
    });
    expect(doc.pagador).toBe("Comercial Pérez, C.A.");
    expect(doc.text).not.toContain("tercero — relación");
  });

  it("sin shipment_code usa el Shipping Mark del cliente como Ref.", () => {
    const doc = buildReceiptDoc({
      receipt: receipt(),
      invoice: {
        invoice_code: "F-2026-0031",
        shipment_code: null,
        client_markbox: "DTD-5452",
      },
      acuerdoVersion: "v2.1",
    });
    expect(doc.refEnvio).toBe("DTD-5452");
  });

  it("recibo SIN factura (recibido_sin_ref): Ref. y Cliente pendientes + estado visible COPY §7", () => {
    const doc = buildReceiptDoc({
      receipt: receipt({
        client_name: null,
        client_markbox: null,
        application_status: "recibido_sin_ref",
      }),
      invoice: null,
      acuerdoVersion: null,
    });
    expect(doc.refEnvio).toBe(RECEIPT_PENDING_REF);
    expect(doc.cliente).toBe("Pendiente de identificación");
    expect(doc.pagador).toBe("—");
    expect(doc.estadoCliente).toBe("Pago recibido — pendiente de identificación");
    // Sigue siendo un recibo de mandato completo (constancia COPY §3).
    expect(doc.text).toContain(RECEIPT_MANDATE_LEGEND);
    expect(doc.text).toContain(RECEIPT_NOT_FISCAL);
    expect(doc.acuerdoLine).toBe(
      "Documento sujeto al Acuerdo de Servicios v— aceptado por el Cliente.",
    );
  });

  it("recibo aplicado NO lleva estadoCliente", () => {
    const doc = buildReceiptDoc({
      receipt: receipt(),
      invoice: null,
      acuerdoVersion: "v2.1",
    });
    expect(doc.estadoCliente).toBeNull();
  });

  it("regla absoluta del handoff: cero DoorTuDoor Trading / J-50220185", () => {
    const docs = [
      buildReceiptDoc({
        receipt: receipt({ payer_kind: "tercero", payer_name: "X", payer_relation: "socio" }),
        invoice: { invoice_code: "F-1", shipment_code: "DTD-1-1", client_markbox: "DTD-1" },
        acuerdoVersion: "v3.0",
      }),
      buildReceiptDoc({
        receipt: receipt({ application_status: "recibido_sin_ref", client_name: null, client_markbox: null }),
      }),
    ];
    for (const doc of docs) {
      expect(doc.text).not.toMatch(/doortudoor/i);
      expect(doc.text).not.toContain("J-50220185");
      // Y SÍ lleva al agente de cobranza correcto (excepción BRAND-CHECK).
      expect(doc.text).toContain("Inversiones DTD Services, C.A.");
    }
  });
});

// ── normalizeAcuerdoVersion ───────────────────────────────────
describe("normalizeAcuerdoVersion", () => {
  it("pela la v inicial para no imprimir 'vv2.1'", () => {
    expect(normalizeAcuerdoVersion("v2.1")).toBe("2.1");
    expect(normalizeAcuerdoVersion("V3.0")).toBe("3.0");
  });
  it("versión sin prefijo pasa tal cual", () => {
    expect(normalizeAcuerdoVersion("3.0")).toBe("3.0");
  });
  it("null/vacío ⇒ '—' (la línea imprime 'v—')", () => {
    expect(normalizeAcuerdoVersion(null)).toBe("—");
    expect(normalizeAcuerdoVersion(undefined)).toBe("—");
    expect(normalizeAcuerdoVersion("  ")).toBe("—");
  });
});

// ── pickAcuerdoVersion (aceptación → vigente → null) ──────────
describe("pickAcuerdoVersion", () => {
  const VIGENTES = [
    { key: "tyc", version: "v3.0" },
    { key: "operador", version: "v1.4" },
  ];

  it("usa la versión ACEPTADA por el cliente para la orden (gana a la vigente)", () => {
    const v = pickAcuerdoVersion(
      [
        {
          docs: [
            { key: "tyc", version: "v2.1" },
            { key: "operador", version: "v1.4" },
          ],
          hash_verified: true,
        },
      ],
      VIGENTES,
    );
    expect(v).toBe("v2.1");
  });

  it("saltea aceptaciones con hash NO verificado si hay otra íntegra", () => {
    const v = pickAcuerdoVersion(
      [
        { docs: [{ key: "tyc", version: "v9.9" }], hash_verified: false },
        { docs: [{ key: "tyc", version: "v2.1" }], hash_verified: true },
      ],
      VIGENTES,
    );
    expect(v).toBe("v2.1");
  });

  it("si SOLO hay no-verificadas, usa la más reciente que tenga el doc", () => {
    const v = pickAcuerdoVersion(
      [{ docs: [{ key: "tyc", version: "v2.0" }], hash_verified: false }],
      VIGENTES,
    );
    expect(v).toBe("v2.0");
  });

  it("sin aceptaciones ⇒ fallback a la vigente de legal_docs", () => {
    expect(pickAcuerdoVersion([], VIGENTES)).toBe("v3.0");
  });

  it("sin aceptaciones NI vigente ⇒ null (el recibo imprime 'v—')", () => {
    expect(pickAcuerdoVersion([], [])).toBeNull();
    expect(
      pickAcuerdoVersion([], [{ key: "operador", version: "v1.4" }]),
    ).toBeNull();
  });

  it("la key canónica del Acuerdo es 'tyc'", () => {
    expect(ACUERDO_DOC_KEY).toBe("tyc");
  });
});
