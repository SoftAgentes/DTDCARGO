/**
 * Tests de la Rendición quincenal a la Operadora (SDD-0069). Cubren los
 * criterios de aceptación §5 de la spec:
 *
 *  - period: Q1 1-15, Q2 16-último; meses de 28/29/30/31 (febrero bisiesto,
 *    diciembre→enero); sin Date.now (los helpers reciben year/month).
 *  - previewRendition: solo third_party + aplicado + en-rango (excluye sin_ref,
 *    rendido, local_revenue, fuera de rango); USD multi-moneda.
 *  - localRevenueInvoicedSummary: status e issued_at filtran (DEVENGADO).
 *  - neto = recaudado de terceros − servicios locales facturados.
 *  - validateRenditionEmitInput: rango válido, no vacío/invertido.
 *  - CSV: headers + filas de totales.
 *  - hoja imprimible: leyenda + "agente de cobranza de la Operadora"; CERO
 *    "DoorTuDoor Trading" / J-50220185 / "Canopy" (aserciones negativas).
 *  - emit/void (stub Supabase): snapshot congelado + recibos→rendido; anular
 *    revierte rendido→aplicado; guards (no-admin, período vacío).
 */

import { describe, it, expect, vi } from "vitest";

// Admin client solo lo usa el audit (best-effort) + rollback → no-op.
vi.mock("@/lib/db/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      insert: async () => ({ error: null }),
      delete: () => ({ eq: async () => ({ error: null }) }),
    }),
  }),
}));

import {
  lastDayOfMonth,
  quincenaRange,
  quincenaLabel,
  quincenasOfMonth,
} from "../period";
import {
  isReceiptEligible,
  netToOperadora,
  validateRenditionEmitInput,
  type Rendition,
  type RenditionLine,
} from "../types";
import {
  buildRenditionLines,
  buildRenditionPreview,
  computeLocalRevenueInvoiced,
  type EligibleReceiptRow,
  type LocalInvoiceRow,
} from "../queries";
import { buildRenditionCsv, renditionCsvFilename } from "../rendition-csv";
import {
  buildRenditionPrintable,
  RENDITION_FOOTER,
  RENDITION_TITLE,
} from "../printable";

// ── period ────────────────────────────────────────────────────

describe("period · lastDayOfMonth", () => {
  it("31 días (enero, julio, diciembre)", () => {
    expect(lastDayOfMonth(2026, 1)).toBe(31);
    expect(lastDayOfMonth(2026, 7)).toBe(31);
    expect(lastDayOfMonth(2026, 12)).toBe(31);
  });
  it("30 días (abril, junio, septiembre, noviembre)", () => {
    expect(lastDayOfMonth(2026, 4)).toBe(30);
    expect(lastDayOfMonth(2026, 6)).toBe(30);
    expect(lastDayOfMonth(2026, 11)).toBe(30);
  });
  it("febrero NO bisiesto = 28", () => {
    expect(lastDayOfMonth(2026, 2)).toBe(28);
    expect(lastDayOfMonth(2027, 2)).toBe(28);
  });
  it("febrero bisiesto = 29 (2024, 2028)", () => {
    expect(lastDayOfMonth(2024, 2)).toBe(29);
    expect(lastDayOfMonth(2028, 2)).toBe(29);
  });
});

describe("period · quincenaRange", () => {
  it("Q1 = [01, 15]", () => {
    const r = quincenaRange(2026, 6, 1);
    expect(r.from).toBe("2026-06-01");
    expect(r.to).toBe("2026-06-15");
    expect(r.half).toBe(1);
  });
  it("Q2 junio (30 días) = [16, 30]", () => {
    const r = quincenaRange(2026, 6, 2);
    expect(r.from).toBe("2026-06-16");
    expect(r.to).toBe("2026-06-30");
  });
  it("Q2 febrero no bisiesto = [16, 28]", () => {
    expect(quincenaRange(2026, 2, 2).to).toBe("2026-02-28");
  });
  it("Q2 febrero bisiesto = [16, 29]", () => {
    expect(quincenaRange(2024, 2, 2).to).toBe("2024-02-29");
  });
  it("Q2 diciembre = [16, 31] (no se desborda a enero)", () => {
    const r = quincenaRange(2026, 12, 2);
    expect(r.from).toBe("2026-12-16");
    expect(r.to).toBe("2026-12-31");
  });
  it("half inválido se trata como Q2 (defensivo)", () => {
    const r = quincenaRange(2026, 6, 9 as unknown as 2);
    expect(r.from).toBe("2026-06-16");
  });
});

describe("period · quincenaLabel / quincenasOfMonth", () => {
  it("etiqueta legible con día final del mes", () => {
    expect(quincenaLabel(2026, 6, 1)).toBe("junio 2026 · 1-15");
    expect(quincenaLabel(2026, 6, 2)).toBe("junio 2026 · 16-30");
    expect(quincenaLabel(2026, 2, 2)).toBe("febrero 2026 · 16-28");
    expect(quincenaLabel(2024, 2, 2)).toBe("febrero 2024 · 16-29");
  });
  it("quincenasOfMonth devuelve Q1 y Q2 en orden", () => {
    const qs = quincenasOfMonth(2026, 6);
    expect(qs).toHaveLength(2);
    expect(qs[0].half).toBe(1);
    expect(qs[1].half).toBe(2);
    expect(qs[0].to).toBe("2026-06-15");
    expect(qs[1].from).toBe("2026-06-16");
  });
});

// ── elegibilidad ──────────────────────────────────────────────

const RANGE = { from: "2026-06-01", to: "2026-06-15" };

describe("isReceiptEligible", () => {
  const base = {
    fund_class: "third_party" as const,
    application_status: "aplicado" as const,
    received_at: "2026-06-10",
  };
  it("third_party + aplicado + en rango → entra", () => {
    expect(isReceiptEligible(base, RANGE)).toBe(true);
  });
  it("local_revenue → NO entra", () => {
    expect(
      isReceiptEligible({ ...base, fund_class: "local_revenue" }, RANGE),
    ).toBe(false);
  });
  it("recibido_sin_ref → NO entra (no se rinde lo no identificado)", () => {
    expect(
      isReceiptEligible(
        { ...base, application_status: "recibido_sin_ref" },
        RANGE,
      ),
    ).toBe(false);
  });
  it("rendido → NO entra (ya salió)", () => {
    expect(
      isReceiptEligible({ ...base, application_status: "rendido" }, RANGE),
    ).toBe(false);
  });
  it("fuera de rango (antes/después) → NO entra", () => {
    expect(
      isReceiptEligible({ ...base, received_at: "2026-05-31" }, RANGE),
    ).toBe(false);
    expect(
      isReceiptEligible({ ...base, received_at: "2026-06-16" }, RANGE),
    ).toBe(false);
  });
  it("bordes inclusivos (from y to)", () => {
    expect(
      isReceiptEligible({ ...base, received_at: "2026-06-01" }, RANGE),
    ).toBe(true);
    expect(
      isReceiptEligible({ ...base, received_at: "2026-06-15" }, RANGE),
    ).toBe(true);
  });
});

// ── buildRenditionLines (USD multi-moneda) ────────────────────

describe("buildRenditionLines · normalización USD + exclusiones", () => {
  const rows: EligibleReceiptRow[] = [
    {
      id: "r1",
      receipt_code: "R-2026-0001",
      invoice_id: "i1",
      client_markbox: "DTD-0001",
      client_name: "Acme",
      amount: 100,
      currency: "USD",
      fx_rate: null,
      received_at: "2026-06-05",
      application_status: "aplicado",
      fund_class: "third_party",
    },
    {
      id: "r2",
      receipt_code: "R-2026-0002",
      invoice_id: "i2",
      client_markbox: "DTD-0002",
      client_name: "Beta",
      amount: 3600,
      currency: "VES",
      fx_rate: 36, // 3600/36 = 100 USD
      received_at: "2026-06-03",
      application_status: "aplicado",
      fund_class: "third_party",
    },
    {
      id: "r3",
      receipt_code: "R-2026-0003",
      invoice_id: null,
      client_markbox: "DTD-0003",
      client_name: "Gamma",
      amount: 700,
      currency: "CNY", // CNY con tasa CNY/USD → 700/7 = 100 USD (receiptAmountUsd)
      fx_rate: 7,
      received_at: "2026-06-07",
      application_status: "aplicado",
      fund_class: "third_party",
    },
    {
      // excluido: fuera de rango.
      id: "r4",
      receipt_code: "R-2026-0004",
      invoice_id: "i4",
      client_markbox: "DTD-0004",
      client_name: "Delta",
      amount: 999,
      currency: "USD",
      fx_rate: null,
      received_at: "2026-07-01",
      application_status: "aplicado",
      fund_class: "third_party",
    },
  ];
  const invoiceCodeById = new Map([
    ["i1", "F-2026-0001"],
    ["i2", "F-2026-0002"],
  ]);

  it("incluye solo los en-rango y normaliza USD con receiptAmountUsd (USD 1:1 · resto /fx)", () => {
    const lines = buildRenditionLines(rows, invoiceCodeById, RANGE);
    expect(lines.map((l) => l.receiptCode)).toEqual([
      "R-2026-0002", // 06-03
      "R-2026-0001", // 06-05
      "R-2026-0003", // 06-07
    ]);
    const byCode = Object.fromEntries(lines.map((l) => [l.receiptCode, l]));
    expect(byCode["R-2026-0001"].amountUsd).toBe(100); // USD 1:1
    expect(byCode["R-2026-0002"].amountUsd).toBe(100); // VES 3600/36
    expect(byCode["R-2026-0003"].amountUsd).toBe(100); // CNY 700/7
  });

  it("la referencia sale del invoice_code (sin factura → null)", () => {
    const lines = buildRenditionLines(rows, invoiceCodeById, RANGE);
    const byCode = Object.fromEntries(lines.map((l) => [l.receiptCode, l]));
    expect(byCode["R-2026-0001"].reference).toBe("F-2026-0001");
    expect(byCode["R-2026-0003"].reference).toBe(null);
  });
});

// ── computeLocalRevenueInvoiced (DEVENGADO) ───────────────────

describe("computeLocalRevenueInvoiced · status e issued_at filtran", () => {
  const invoices: LocalInvoiceRow[] = [
    {
      fund_class: "local_revenue",
      status: "emitida",
      issued_at: "2026-06-05",
      currency: "USD",
      total_amount: 200,
      fx_rate: null,
    },
    {
      fund_class: "local_revenue",
      status: "pagada",
      issued_at: "2026-06-10",
      currency: "VES",
      total_amount: 7200,
      fx_rate: 36, // 200 USD
    },
    {
      // excluida: borrador no devenga.
      fund_class: "local_revenue",
      status: "borrador",
      issued_at: "2026-06-08",
      currency: "USD",
      total_amount: 999,
      fx_rate: null,
    },
    {
      // excluida: anulada.
      fund_class: "local_revenue",
      status: "anulada",
      issued_at: "2026-06-08",
      currency: "USD",
      total_amount: 999,
      fx_rate: null,
    },
    {
      // excluida: fuera de rango.
      fund_class: "local_revenue",
      status: "emitida",
      issued_at: "2026-05-30",
      currency: "USD",
      total_amount: 999,
      fx_rate: null,
    },
    {
      // excluida: no es local_revenue.
      fund_class: "third_party",
      status: "emitida",
      issued_at: "2026-06-09",
      currency: "USD",
      total_amount: 999,
      fx_rate: null,
    },
    {
      // excluida: sin issued_at (no devengó fecha).
      fund_class: "local_revenue",
      status: "emitida",
      issued_at: null,
      currency: "USD",
      total_amount: 999,
      fx_rate: null,
    },
  ];

  it("suma solo local_revenue + status devengado + issued_at en rango, en USD", () => {
    const r = computeLocalRevenueInvoiced(invoices, RANGE);
    expect(r.invoiceCount).toBe(2);
    expect(r.localRevenueUsd).toBe(400); // 200 USD + 200 (VES/36)
  });
});

// ── neto + preview ────────────────────────────────────────────

describe("netToOperadora + buildRenditionPreview", () => {
  it("neto = recaudado de terceros − servicios locales facturados", () => {
    expect(netToOperadora(1000, 250)).toBe(750);
    expect(netToOperadora(100, 300)).toBe(-200); // puede ser negativo
  });

  it("preview compone los 3 totales con su base", () => {
    const lines: RenditionLine[] = [
      {
        receiptId: "r1",
        receiptCode: "R-2026-0001",
        clientName: "Acme",
        clientMarkbox: "DTD-0001",
        reference: "F-1",
        amount: 600,
        currency: "USD",
        amountUsd: 600,
        receivedAt: "2026-06-05",
      },
      {
        receiptId: "r2",
        receiptCode: "R-2026-0002",
        clientName: "Beta",
        clientMarkbox: "DTD-0002",
        reference: "F-2",
        amount: 400,
        currency: "USD",
        amountUsd: 400,
        receivedAt: "2026-06-06",
      },
    ];
    const preview = buildRenditionPreview(lines, 250, RANGE);
    expect(preview.thirdPartyUsd).toBe(1000);
    expect(preview.localRevenueInvoicedUsd).toBe(250);
    expect(preview.netToOperadoraUsd).toBe(750);
    expect(preview.receiptCount).toBe(2);
  });
});

// ── validador ─────────────────────────────────────────────────

describe("validateRenditionEmitInput", () => {
  it("rango válido pasa", () => {
    const { input, error } = validateRenditionEmitInput({
      from: "2026-06-01",
      to: "2026-06-15",
    });
    expect(error).toBeUndefined();
    expect(input).toEqual({ from: "2026-06-01", to: "2026-06-15" });
  });
  it("formato inválido → error", () => {
    expect(validateRenditionEmitInput({ from: "ayer", to: "2026-06-15" }).error)
      .toBeTruthy();
    expect(validateRenditionEmitInput({ from: "2026-06-01" }).error).toBeTruthy();
  });
  it("rango invertido (from > to) → error", () => {
    expect(
      validateRenditionEmitInput({ from: "2026-06-20", to: "2026-06-01" })
        .error,
    ).toBeTruthy();
  });
});

// ── helper de rendición de muestra para CSV + imprimible ──────

function sampleRendition(over: Partial<Rendition> = {}): Rendition {
  return {
    id: "rend1",
    tenant_id: "t1",
    rendition_code: "RND-2026-0001",
    period_from: "2026-06-16",
    period_to: "2026-06-30",
    third_party_usd: 1000,
    local_revenue_usd: 250,
    net_to_operadora_usd: 750,
    receipt_count: 2,
    status: "emitida",
    void_reason: null,
    created_by: "u1",
    emitted_at: "2026-07-01T00:00:00Z",
    created_at: "2026-07-01T00:00:00Z",
    ...over,
  };
}

const SAMPLE_LINES: RenditionLine[] = [
  {
    receiptId: "r1",
    receiptCode: "R-2026-0001",
    clientName: "Acme",
    clientMarkbox: "DTD-0001",
    reference: "F-2026-0001",
    amount: 600,
    currency: "USD",
    amountUsd: 600,
    receivedAt: "2026-06-20",
  },
  {
    receiptId: "r2",
    receiptCode: "R-2026-0002",
    clientName: "Beta",
    clientMarkbox: "DTD-0002",
    reference: "F-2026-0002",
    amount: 400,
    currency: "USD",
    amountUsd: 400,
    receivedAt: "2026-06-22",
  },
];

// ── CSV ───────────────────────────────────────────────────────

describe("buildRenditionCsv", () => {
  it("filename usa el rango del período", () => {
    expect(renditionCsvFilename("2026-06-16", "2026-06-30")).toBe(
      "rendicion-2026-06-16-2026-06-30.csv",
    );
  });
  it("headers + un row por recibo + filas de totales", () => {
    const { filename, content } = buildRenditionCsv(
      sampleRendition(),
      SAMPLE_LINES,
    );
    expect(filename).toBe("rendicion-2026-06-16-2026-06-30.csv");
    const rows = content.split("\r\n");
    expect(rows[0]).toContain("Recibo");
    expect(rows[0]).toContain("Monto USD");
    expect(content).toContain("R-2026-0001");
    expect(content).toContain("R-2026-0002");
    expect(content).toContain("Recaudado de terceros (caja)");
    expect(content).toContain("Servicios locales facturados (devengado)");
    expect(content).toContain("Saldo a favor de la Operadora");
  });
  it("CERO Canopy / DoorTuDoor Trading / J-50220185 en el CSV", () => {
    const { content } = buildRenditionCsv(sampleRendition(), SAMPLE_LINES);
    expect(content).not.toMatch(/canopy/i);
    expect(content).not.toMatch(/doortudoor trading/i);
    expect(content).not.toContain("J-50220185");
  });
});

// ── hoja imprimible ───────────────────────────────────────────

describe("buildRenditionPrintable", () => {
  it("encabezado RENDICIÓN DE CUENTAS A LA OPERADORA + período + 3 totales", () => {
    const doc = buildRenditionPrintable({
      rendition: sampleRendition(),
      lines: SAMPLE_LINES,
    });
    expect(doc.title).toBe(RENDITION_TITLE);
    expect(doc.code).toBe("RND-2026-0001");
    expect(doc.periodLine).toBe("Período: 2026-06-16 a 2026-06-30");
    expect(doc.totals).toHaveLength(3);
    expect(doc.totals[0].formatted).toBe("1,000.00");
    expect(doc.totals[2].formatted).toBe("750.00");
    expect(doc.lines).toHaveLength(2);
  });

  it("pie = agente de cobranza de la Operadora (literal)", () => {
    const doc = buildRenditionPrintable({
      rendition: sampleRendition(),
      lines: SAMPLE_LINES,
    });
    expect(doc.footer).toBe(RENDITION_FOOTER);
    expect(doc.text).toContain(
      "en su condición de agente de cobranza de la Operadora",
    );
  });

  it("nombra 'la Operadora' y NUNCA 'Canopy' / 'DoorTuDoor Trading' / J-50220185", () => {
    const doc = buildRenditionPrintable({
      rendition: sampleRendition(),
      lines: SAMPLE_LINES,
    });
    expect(doc.text).toMatch(/la Operadora/);
    expect(doc.text).not.toMatch(/canopy/i);
    expect(doc.text).not.toMatch(/doortudoor trading/i);
    expect(doc.text).not.toContain("J-50220185");
  });

  it("rendición anulada muestra el aviso con el motivo", () => {
    const doc = buildRenditionPrintable({
      rendition: sampleRendition({ status: "anulada", void_reason: "Error de período" }),
      lines: SAMPLE_LINES,
    });
    expect(doc.voidNotice).toContain("ANULADA");
    expect(doc.voidNotice).toContain("Error de período");
    expect(doc.status).toBe("Anulada");
  });
});
