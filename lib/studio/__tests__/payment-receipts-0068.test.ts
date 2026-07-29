/**
 * Tests de SDD-0068 (Recibos de cobranza con mandato) — capa pura.
 *
 * Cubre los criterios de aceptación de la sección 5 del spec:
 *  - validatePaymentInput extendido: tercero sin nombre/relación/licitud ⇒
 *    fieldErrors (decisión #4); cliente no exige nada y anula campos de tercero.
 *  - validateUnidentifiedPaymentInput: amount>0, cuenta requerida, VES exige fx.
 *  - deriveFundClass: 4 servicios + factura sin shipment (decisión #5).
 *  - Builders contables del sin-ref y la reclasificación (DR/CR balanceados,
 *    2 líneas = una clase de fondos por asiento, invariante del mandato).
 *  - computeFundsSeparation: suma por clase normalizada a USD.
 *  - Labels/microcopy COPY_LEGAL_UI §7 LITERALES (interno + "Cliente ve"),
 *    con `rendido` definido (no visible) — su transición es SDD-D.
 */

import { describe, it, expect } from "vitest";
import {
  buildReclassLines,
  buildUnidentifiedReceiptLines,
  RECLASS_SOURCE,
  UNIDENTIFIED_FUNDS_CODE,
} from "../accounting/receipt-posting";
import { computeFundsSeparation } from "../payment-queries";
import {
  APPLICATION_STATUS_META,
  applicationStatusClientView,
  applicationStatusLabel,
  deriveFundClass,
  fundClassLabel,
  UNIDENTIFIED_CLIENT_NOTICE,
  validatePaymentInput,
  validateUnidentifiedPaymentInput,
} from "../payment-types";

// ── validatePaymentInput · pagador (decisión #4 / #7) ─────────
describe("validatePaymentInput · pagador", () => {
  const base = {
    amount: 500,
    cashAccountId: "acc-bank",
    method: "transferencia" as const,
    receivedAt: "2026-06-01",
    reference: null,
    notes: null,
  };

  it("default = cliente, sin checkbox (licitDeclared false)", () => {
    const r = validatePaymentInput(base, 1000);
    expect(r.fieldErrors).toBeUndefined();
    expect(r.input?.payerKind).toBe("cliente");
    expect(r.input?.payerName).toBeNull();
    expect(r.input?.payerRelation).toBeNull();
    expect(r.input?.licitDeclared).toBe(false);
  });

  it("tercero completo es válido (nombre + relación + licitud)", () => {
    const r = validatePaymentInput(
      {
        ...base,
        payerKind: "tercero",
        payerName: "María Pérez",
        payerRelation: "familiar",
        licitDeclared: true,
      },
      1000,
    );
    expect(r.fieldErrors).toBeUndefined();
    expect(r.input?.payerKind).toBe("tercero");
    expect(r.input?.payerName).toBe("María Pérez");
    expect(r.input?.payerRelation).toBe("familiar");
    expect(r.input?.licitDeclared).toBe(true);
  });

  it("tercero SIN nombre ⇒ fieldError payerName", () => {
    const r = validatePaymentInput(
      { ...base, payerKind: "tercero", payerRelation: "socio", licitDeclared: true },
      1000,
    );
    expect(r.fieldErrors?.payerName).toBeDefined();
    expect(r.input).toBeUndefined();
  });

  it("tercero SIN relación ⇒ fieldError payerRelation", () => {
    const r = validatePaymentInput(
      { ...base, payerKind: "tercero", payerName: "María", licitDeclared: true },
      1000,
    );
    expect(r.fieldErrors?.payerRelation).toBeDefined();
  });

  it("tercero con relación inválida ⇒ fieldError payerRelation", () => {
    const r = validatePaymentInput(
      {
        ...base,
        payerKind: "tercero",
        payerName: "María",
        payerRelation: "primo" as never,
        licitDeclared: true,
      },
      1000,
    );
    expect(r.fieldErrors?.payerRelation).toBeDefined();
  });

  it("tercero SIN declaración de licitud ⇒ fieldError licitDeclared", () => {
    const r = validatePaymentInput(
      {
        ...base,
        payerKind: "tercero",
        payerName: "María",
        payerRelation: "familiar",
        licitDeclared: false,
      },
      1000,
    );
    expect(r.fieldErrors?.licitDeclared).toBeDefined();
  });

  it("tercero sin NADA ⇒ los 3 fieldErrors a la vez", () => {
    const r = validatePaymentInput({ ...base, payerKind: "tercero" }, 1000);
    expect(r.fieldErrors?.payerName).toBeDefined();
    expect(r.fieldErrors?.payerRelation).toBeDefined();
    expect(r.fieldErrors?.licitDeclared).toBeDefined();
  });

  it("cliente IGNORA campos de tercero (se anulan, licitud false)", () => {
    const r = validatePaymentInput(
      {
        ...base,
        payerKind: "cliente",
        payerName: "No debería quedar",
        payerRelation: "socio",
        licitDeclared: true,
      },
      1000,
    );
    expect(r.fieldErrors).toBeUndefined();
    expect(r.input?.payerName).toBeNull();
    expect(r.input?.payerRelation).toBeNull();
    expect(r.input?.licitDeclared).toBe(false);
  });
});

// ── validateUnidentifiedPaymentInput (sin-ref, cláusula 7.3) ──
describe("validateUnidentifiedPaymentInput", () => {
  const valid = {
    amount: 800,
    currency: "USD" as const,
    fxRate: null,
    cashAccountId: "acc-bank",
    method: "zelle" as const,
    receivedAt: "2026-06-05",
    reference: "ZELLE-991",
    notes: null,
  };

  it("acepta input válido", () => {
    const r = validateUnidentifiedPaymentInput(valid);
    expect(r.fieldErrors).toBeUndefined();
    expect(r.input?.amount).toBe(800);
    expect(r.input?.currency).toBe("USD");
  });

  it("rechaza amount ≤ 0", () => {
    expect(
      validateUnidentifiedPaymentInput({ ...valid, amount: 0 }).fieldErrors
        ?.amount,
    ).toBeDefined();
    expect(
      validateUnidentifiedPaymentInput({ ...valid, amount: -10 }).fieldErrors
        ?.amount,
    ).toBeDefined();
  });

  it("rechaza cuenta de caja faltante", () => {
    const r = validateUnidentifiedPaymentInput({ ...valid, cashAccountId: "" });
    expect(r.fieldErrors?.cashAccountId).toBeDefined();
  });

  it("VES sin tasa ⇒ fieldError fxRate; con tasa pasa", () => {
    expect(
      validateUnidentifiedPaymentInput({ ...valid, currency: "VES", fxRate: null })
        .fieldErrors?.fxRate,
    ).toBeDefined();
    const ok = validateUnidentifiedPaymentInput({
      ...valid,
      currency: "VES",
      fxRate: 36.5,
    });
    expect(ok.fieldErrors).toBeUndefined();
    expect(ok.input?.fxRate).toBe(36.5);
  });

  it("moneda desconocida cae a USD · fecha inválida es error · default hoy", () => {
    const r = validateUnidentifiedPaymentInput({
      ...valid,
      currency: "EUR" as never,
    });
    expect(r.input?.currency).toBe("USD");

    expect(
      validateUnidentifiedPaymentInput({ ...valid, receivedAt: "05/06/2026" })
        .fieldErrors?.receivedAt,
    ).toBeDefined();

    const d = validateUnidentifiedPaymentInput({ ...valid, receivedAt: "" });
    expect(d.input?.receivedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

// ── deriveFundClass (decisión #5) ─────────────────────────────
describe("deriveFundClass", () => {
  it("consolidado_lcl / puerta_a_puerta_DDP / fcl_directo ⇒ third_party", () => {
    expect(deriveFundClass("consolidado_lcl")).toBe("third_party");
    expect(deriveFundClass("puerta_a_puerta_DDP")).toBe("third_party");
    expect(deriveFundClass("fcl_directo")).toBe("third_party");
  });

  it("transporte_terrestre ⇒ local_revenue (servicio local)", () => {
    expect(deriveFundClass("transporte_terrestre")).toBe("local_revenue");
  });

  it("factura SIN shipment (null/undefined/'') ⇒ local_revenue", () => {
    expect(deriveFundClass(null)).toBe("local_revenue");
    expect(deriveFundClass(undefined)).toBe("local_revenue");
    expect(deriveFundClass("")).toBe("local_revenue");
  });

  it("servicio desconocido no vacío ⇒ third_party (conservador)", () => {
    expect(deriveFundClass("servicio_nuevo")).toBe("third_party");
  });
});

// ── Builders contables del sin-ref + reclasificación ──────────
describe("buildUnidentifiedReceiptLines (DR caja / CR puente)", () => {
  const lines = buildUnidentifiedReceiptLines("acc-bank", "acc-bridge", 800);

  it("debita la caja y acredita la cuenta puente, balanceado", () => {
    const cash = lines.find((l) => l.account_id === "acc-bank")!;
    const bridge = lines.find((l) => l.account_id === "acc-bridge")!;
    expect(cash.debit).toBe(800);
    expect(cash.credit).toBe(0);
    expect(bridge.credit).toBe(800);
    expect(bridge.debit).toBe(0);
  });

  it("invariante del mandato: 2 líneas de UN solo recibo (una clase por asiento)", () => {
    expect(lines).toHaveLength(2);
    for (const l of lines) {
      expect(l.debit > 0 && l.credit > 0).toBe(false);
    }
    const debit = lines.reduce((s, l) => s + l.debit, 0);
    const credit = lines.reduce((s, l) => s + l.credit, 0);
    expect(debit).toBe(credit);
  });
});

describe("buildReclassLines (DR puente / CR 1.1.2)", () => {
  const lines = buildReclassLines("acc-bridge", "acc-ar", 800);

  it("debita la puente y acredita CxC clientes, balanceado", () => {
    const bridge = lines.find((l) => l.account_id === "acc-bridge")!;
    const ar = lines.find((l) => l.account_id === "acc-ar")!;
    expect(bridge.debit).toBe(800);
    expect(bridge.credit).toBe(0);
    expect(ar.credit).toBe(800);
    expect(ar.debit).toBe(0);
    expect(lines).toHaveLength(2);
  });

  it("la cuenta puente es 2.1.8 (2.1.7 ya la tomó 0114) y el source distingue la reclasificación", () => {
    expect(UNIDENTIFIED_FUNDS_CODE).toBe("2.1.8");
    expect(RECLASS_SOURCE).toBe("receipt_reclass");
  });
});

// ── computeFundsSeparation (card de separación, insumo SDD-D) ──
describe("computeFundsSeparation", () => {
  const range = { from: "2026-06-01", to: "2026-06-30" };

  it("suma por clase normalizando a USD (VES via fx)", () => {
    const s = computeFundsSeparation(
      [
        { amount: 1000, currency: "USD", fx_rate: null, fund_class: "third_party", application_status: "aplicado" },
        { amount: 18000, currency: "VES", fx_rate: 36, fund_class: "third_party", application_status: "aplicado" }, // 500 USD
        { amount: 300, currency: "USD", fx_rate: null, fund_class: "local_revenue", application_status: "aplicado" },
        { amount: 200, currency: "USD", fx_rate: null, fund_class: "third_party", application_status: "recibido_sin_ref" },
      ],
      range,
    );
    expect(s.thirdPartyUsd).toBe(1700); // 1000 + 500 + 200 (el sin-ref ES third_party hasta identificar)
    expect(s.localRevenueUsd).toBe(300);
    expect(s.unidentifiedUsd).toBe(200);
    expect(s.unidentifiedCount).toBe(1);
    expect(s.receiptCount).toBe(4);
    expect(s.from).toBe("2026-06-01");
    expect(s.to).toBe("2026-06-30");
  });

  it("vacío ⇒ todo en cero", () => {
    const s = computeFundsSeparation([], range);
    expect(s.thirdPartyUsd).toBe(0);
    expect(s.localRevenueUsd).toBe(0);
    expect(s.unidentifiedUsd).toBe(0);
    expect(s.unidentifiedCount).toBe(0);
  });
});

// ── Labels COPY §7 — LITERALES (efecto probatorio) ────────────
describe("labels COPY §7 (literales)", () => {
  it("recibido_sin_ref: interno + Cliente ve", () => {
    expect(APPLICATION_STATUS_META.recibido_sin_ref.internal).toBe(
      "Fondos en cuenta sin cruce",
    );
    expect(APPLICATION_STATUS_META.recibido_sin_ref.clientView).toBe(
      "Pago recibido — pendiente de identificación",
    );
  });

  it("identificado: interno + Cliente ve con {fecha_fondos}", () => {
    expect(APPLICATION_STATUS_META.identificado.internal).toBe(
      "Cruzado con operación; imputación retroactiva aplicada",
    );
    expect(APPLICATION_STATUS_META.identificado.clientView).toBe(
      "Pago aplicado el {fecha_fondos}",
    );
    expect(
      applicationStatusClientView("identificado", { fechaFondos: "2026-06-01" }),
    ).toBe("Pago aplicado el 2026-06-01");
  });

  it("aplicado: interno + Cliente ve con {saldo}", () => {
    expect(APPLICATION_STATUS_META.aplicado.internal).toBe(
      "Saldo actualizado, gate de despacho evaluado",
    );
    expect(APPLICATION_STATUS_META.aplicado.clientView).toBe("Saldo: {saldo}");
    expect(applicationStatusClientView("aplicado", { saldo: "$120.00" })).toBe(
      "Saldo: $120.00",
    );
  });

  it("rendido: DEFINIDO (rendición quincenal) pero NO visible al cliente — transición diferida a SDD-D", () => {
    expect(APPLICATION_STATUS_META.rendido.internal).toBe(
      "Incluido en rendición quincenal a la Operadora",
    );
    expect(APPLICATION_STATUS_META.rendido.clientView).toBeNull();
    expect(applicationStatusClientView("rendido")).toBeNull();
    expect(applicationStatusLabel("rendido")).toBe("Rendido");
  });

  it("aviso COPY §3 (estado visible cuando el pago no cruza) — literal", () => {
    expect(UNIDENTIFIED_CLIENT_NOTICE).toBe(
      "Pago recibido — pendiente de identificación. Envíanos tu referencia para aplicarlo. Una vez identificado, se imputará a la fecha en que recibimos los fondos.",
    );
  });

  it("labels de clase de fondos", () => {
    expect(fundClassLabel("third_party")).toBe("Fondos de terceros");
    expect(fundClassLabel("local_revenue")).toBe("Ingreso local");
  });
});
