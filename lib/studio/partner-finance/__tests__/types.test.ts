/**
 * Tests de los helpers puros + validadores de partner-finance
 * (SDD-0059 · Slice A). Cubre §6 Slice A: validators, derivación de saldo neto
 * USD/RMB, net_amount con notas de crédito, máquinas de estado (cargos y
 * claims) válidas/inválidas, cálculo de spread/comisión.
 */

import { describe, it, expect } from "vitest";
import {
  // monedas / bill_kind
  isPartnerCurrency,
  isBillKind,
  billKindLabel,
  billKindTone,
  billKindRequiresShipment,
  // ledger
  isLedgerDirection,
  isLedgerEntryType,
  ledgerEntryTypeLabel,
  computePartnerBalance,
  // charges
  isChargeStatus,
  chargeStatusLabel,
  chargeStatusTone,
  canTransitionCharge,
  deriveNetAmount,
  payableAmount,
  // conversions
  computeConversionSpread,
  isConversionFromCurrency,
  isConversionToCurrency,
  // claim offsets
  canTransitionClaimOffset,
  isClaimOffsetStatus,
  claimOffsetStatusLabel,
  // validators
  validateLedgerEntryInput,
  validateChargeInput,
  validateCreditNoteInput,
  validateConversionInput,
  validateClaimOffsetInput,
} from "../types";

// ── Monedas + bill_kind ───────────────────────────────────────
describe("monedas del dominio", () => {
  it("isPartnerCurrency acepta USD/USDT/RMB/VES y rechaza otros", () => {
    expect(isPartnerCurrency("USD")).toBe(true);
    expect(isPartnerCurrency("RMB")).toBe(true);
    expect(isPartnerCurrency("EUR")).toBe(false);
    expect(isPartnerCurrency(123)).toBe(false);
  });
});

describe("bill_kind (PP/CA/full)", () => {
  it("reconoce los 3 kinds y rechaza basura", () => {
    expect(isBillKind("pp")).toBe(true);
    expect(isBillKind("ca")).toBe(true);
    expect(isBillKind("full")).toBe(true);
    expect(isBillKind("xx")).toBe(false);
  });
  it("PP/CA requieren shipment, full no", () => {
    expect(billKindRequiresShipment("pp")).toBe(true);
    expect(billKindRequiresShipment("ca")).toBe(true);
    expect(billKindRequiresShipment("full")).toBe(false);
  });
  it("label/tone resuelven o caen al raw", () => {
    expect(billKindLabel("pp")).toMatch(/Depósito/);
    expect(billKindLabel("zzz")).toBe("zzz");
    expect(billKindTone("ca")).toBe("info");
    expect(billKindTone("zzz")).toBe("neutral");
  });
});

// ── Ledger: dirección, tipos, saldo neto ──────────────────────
describe("ledger enums", () => {
  it("dirección debe/haber", () => {
    expect(isLedgerDirection("debe")).toBe(true);
    expect(isLedgerDirection("haber")).toBe(true);
    expect(isLedgerDirection("medio")).toBe(false);
  });
  it("entry types y su label", () => {
    expect(isLedgerEntryType("costo_contenedor")).toBe(true);
    expect(isLedgerEntryType("pago_fabrica_pp")).toBe(true);
    expect(isLedgerEntryType("inventado")).toBe(false);
    expect(ledgerEntryTypeLabel("conversion_divisa")).toMatch(/[Cc]onversión/);
    expect(ledgerEntryTypeLabel("raw")).toBe("raw");
  });
});

describe("computePartnerBalance (saldo neto USD + RMB)", () => {
  it("haber suma, debe resta, en ambas monedas", () => {
    const b = computePartnerBalance([
      { direction: "haber", amount_usd: 1000, amount_rmb: 7000 },
      { direction: "debe", amount_usd: 400, amount_rmb: 2800 },
      { direction: "haber", amount_usd: 250, amount_rmb: 0 },
    ]);
    expect(b.net_usd).toBe(850); // 1000 - 400 + 250
    expect(b.net_rmb).toBe(4200); // 7000 - 2800 + 0
    expect(b.entry_count).toBe(3);
  });

  it("saldo deudor (negativo) cuando le pagamos de más", () => {
    const b = computePartnerBalance([
      { direction: "haber", amount_usd: 100, amount_rmb: 0 },
      { direction: "debe", amount_usd: 300, amount_rmb: 0 },
    ]);
    expect(b.net_usd).toBe(-200);
  });

  it("ignora entries soft-deleted", () => {
    const b = computePartnerBalance([
      { direction: "haber", amount_usd: 500, amount_rmb: 0 },
      {
        direction: "haber",
        amount_usd: 999,
        amount_rmb: 0,
        deleted_at: "2026-01-01",
      },
    ]);
    expect(b.net_usd).toBe(500);
    expect(b.entry_count).toBe(1);
  });

  it("set vacío → 0/0/0", () => {
    const b = computePartnerBalance([]);
    expect(b).toEqual({ net_usd: 0, net_rmb: 0, entry_count: 0 });
  });

  it("redondea a 2 decimales (sin drift de float)", () => {
    const b = computePartnerBalance([
      { direction: "haber", amount_usd: 0.1, amount_rmb: 0 },
      { direction: "haber", amount_usd: 0.2, amount_rmb: 0 },
    ]);
    expect(b.net_usd).toBe(0.3);
  });
});

// ── Charges: estado, transición, net_amount ───────────────────
describe("charge status", () => {
  it("reconoce los 4 estados", () => {
    expect(isChargeStatus("vigente")).toBe(true);
    expect(isChargeStatus("disputado")).toBe(true);
    expect(isChargeStatus("corregido")).toBe(true);
    expect(isChargeStatus("cancelado")).toBe(true);
    expect(isChargeStatus("zzz")).toBe(false);
  });
  it("label/tone", () => {
    expect(chargeStatusLabel("disputado")).toBe("Disputado");
    expect(chargeStatusTone("corregido")).toBe("success");
    expect(chargeStatusTone("zzz")).toBe("neutral");
  });
});

describe("canTransitionCharge (máquina de estados)", () => {
  it("transiciones válidas", () => {
    expect(canTransitionCharge("vigente", "disputado")).toBe(true);
    expect(canTransitionCharge("vigente", "cancelado")).toBe(true);
    expect(canTransitionCharge("disputado", "corregido")).toBe(true);
    expect(canTransitionCharge("disputado", "cancelado")).toBe(true);
    expect(canTransitionCharge("disputado", "vigente")).toBe(true);
  });
  it("transiciones inválidas", () => {
    expect(canTransitionCharge("vigente", "corregido")).toBe(false); // salta disputa
    expect(canTransitionCharge("corregido", "vigente")).toBe(false); // terminal
    expect(canTransitionCharge("cancelado", "disputado")).toBe(false); // terminal
    expect(canTransitionCharge("vigente", "vigente")).toBe(false); // no-op
  });
});

describe("deriveNetAmount (net = amount − Σ notas vivas)", () => {
  it("sin notas → net == amount", () => {
    expect(deriveNetAmount(1500, [])).toEqual({
      credited: 0,
      net_amount: 1500,
    });
  });
  it("una nota descuenta", () => {
    const r = deriveNetAmount(1500, [{ amount: 200 }]);
    expect(r.credited).toBe(200);
    expect(r.net_amount).toBe(1300);
  });
  it("varias notas suman; ignora notas soft-deleted", () => {
    const r = deriveNetAmount(1000, [
      { amount: 100 },
      { amount: 50 },
      { amount: 9999, deleted_at: "2026-02-02" },
    ]);
    expect(r.credited).toBe(150);
    expect(r.net_amount).toBe(850);
  });
  it("clamp a 0 si las notas superan el bruto (nunca negativo)", () => {
    const r = deriveNetAmount(100, [{ amount: 80 }, { amount: 80 }]);
    expect(r.net_amount).toBe(0);
    expect(r.credited).toBe(160);
  });
});

describe("payableAmount (guard: nunca el bruto si hay nota)", () => {
  it("usa net_amount cuando viene", () => {
    expect(payableAmount({ amount: 1000, net_amount: 800 })).toBe(800);
  });
  it("deriva de credited cuando no hay net_amount", () => {
    expect(payableAmount({ amount: 1000, credited: 250 })).toBe(750);
  });
  it("sin notas → el bruto", () => {
    expect(payableAmount({ amount: 1000 })).toBe(1000);
  });
  it("clamp a 0 si credited supera el bruto", () => {
    expect(payableAmount({ amount: 100, credited: 250 })).toBe(0);
  });
});

// ── Conversions: spread + comisión ────────────────────────────
describe("computeConversionSpread", () => {
  it("spread y comisión derivados del market vs effective", () => {
    // effective 7.35, market 7.00 → spread = 5%, comisión = 1000 * 5% = 50
    const r = computeConversionSpread({
      fromAmount: 1000,
      effectiveRate: 7.35,
      marketRate: 7.0,
    });
    expect(r.spread_pct).toBeCloseTo(5, 4);
    expect(r.commission_amount).toBe(50);
  });

  it("sin market_rate → spread null, comisión 0 (sin override)", () => {
    const r = computeConversionSpread({
      fromAmount: 1000,
      effectiveRate: 7.35,
      marketRate: null,
    });
    expect(r.spread_pct).toBeNull();
    expect(r.commission_amount).toBe(0);
  });

  it("override explícito de comisión gana", () => {
    const r = computeConversionSpread({
      fromAmount: 1000,
      effectiveRate: 7.35,
      marketRate: 7.0,
      commissionAmount: 77.5,
    });
    expect(r.commission_amount).toBe(77.5);
    expect(r.spread_pct).toBeCloseTo(5, 4); // el spread se sigue reportando
  });

  it("spread negativo (effective < market) → comisión sobre el valor absoluto", () => {
    const r = computeConversionSpread({
      fromAmount: 1000,
      effectiveRate: 6.65,
      marketRate: 7.0,
    });
    expect(r.spread_pct).toBeCloseTo(-5, 4);
    expect(r.commission_amount).toBe(50);
  });

  it("market_rate 0 → tratado como sin referencia (no divide por cero)", () => {
    const r = computeConversionSpread({
      fromAmount: 1000,
      effectiveRate: 7,
      marketRate: 0,
    });
    expect(r.spread_pct).toBeNull();
    expect(r.commission_amount).toBe(0);
  });
});

describe("conversion currency guards", () => {
  it("from acepta USD/USDT/VES, no RMB", () => {
    expect(isConversionFromCurrency("USD")).toBe(true);
    expect(isConversionFromCurrency("VES")).toBe(true);
    expect(isConversionFromCurrency("RMB")).toBe(false);
  });
  it("to acepta RMB/USD, no VES", () => {
    expect(isConversionToCurrency("RMB")).toBe(true);
    expect(isConversionToCurrency("USD")).toBe(true);
    expect(isConversionToCurrency("VES")).toBe(false);
  });
});

// ── Claim offsets: máquina lineal ─────────────────────────────
describe("claim offset status", () => {
  it("reconoce los 5 estados + label", () => {
    expect(isClaimOffsetStatus("reclamado")).toBe(true);
    expect(isClaimOffsetStatus("cerrado")).toBe(true);
    expect(isClaimOffsetStatus("zzz")).toBe(false);
    expect(claimOffsetStatusLabel("pagado_en_china")).toMatch(/China/);
  });
});

describe("canTransitionClaimOffset (lineal, sin saltos ni retrocesos)", () => {
  it("avanza un paso a la vez", () => {
    expect(canTransitionClaimOffset("reclamado", "reconocido_proveedor")).toBe(
      true,
    );
    expect(
      canTransitionClaimOffset("reconocido_proveedor", "pagado_en_china"),
    ).toBe(true);
    expect(
      canTransitionClaimOffset("pagado_en_china", "aplicado_a_cliente"),
    ).toBe(true);
    expect(canTransitionClaimOffset("aplicado_a_cliente", "cerrado")).toBe(
      true,
    );
  });
  it("rechaza saltos y retrocesos", () => {
    expect(canTransitionClaimOffset("reclamado", "pagado_en_china")).toBe(
      false,
    );
    expect(canTransitionClaimOffset("pagado_en_china", "reclamado")).toBe(
      false,
    );
    expect(canTransitionClaimOffset("cerrado", "aplicado_a_cliente")).toBe(
      false,
    );
    expect(canTransitionClaimOffset("reclamado", "reclamado")).toBe(false);
  });
});

// ── Validadores ───────────────────────────────────────────────
describe("validateLedgerEntryInput", () => {
  it("acepta un movimiento válido", () => {
    const r = validateLedgerEntryInput({
      supplier_id: "sup-1",
      entry_type: "costo_contenedor",
      direction: "haber",
      amount_usd: "1200.5",
      amount_rmb: "8400",
      currency_paid: "USDT",
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.input.amount_usd).toBe(1200.5);
      expect(r.input.currency_paid).toBe("USDT");
    }
  });
  it("rechaza sin supplier, tipo/dirección inválidos", () => {
    const r = validateLedgerEntryInput({
      supplier_id: "",
      entry_type: "xx",
      direction: "yy",
      amount_usd: 10,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.fieldErrors.supplier_id).toBeTruthy();
      expect(r.fieldErrors.entry_type).toBeTruthy();
      expect(r.fieldErrors.direction).toBeTruthy();
    }
  });
  it("rechaza monto USD+RMB ambos cero", () => {
    const r = validateLedgerEntryInput({
      supplier_id: "sup-1",
      entry_type: "ajuste",
      direction: "debe",
      amount_usd: 0,
      amount_rmb: 0,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.fieldErrors.amount_usd).toBeTruthy();
  });
  it("rechaza fx_rate <= 0", () => {
    const r = validateLedgerEntryInput({
      supplier_id: "sup-1",
      entry_type: "ajuste",
      direction: "debe",
      amount_usd: 10,
      fx_rate: "-3",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.fieldErrors.fx_rate).toBeTruthy();
  });
});

describe("validateChargeInput", () => {
  it("acepta un cargo válido (status default vigente)", () => {
    const r = validateChargeInput({
      supplier_id: "sup-1",
      description: "超重 Overweight",
      amount: "150",
      currency: "RMB",
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.input.status).toBe("vigente");
      expect(r.input.amount).toBe(150);
    }
  });
  it("rechaza monto <= 0 y descripción vacía", () => {
    const r = validateChargeInput({
      supplier_id: "sup-1",
      description: "  ",
      amount: 0,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.fieldErrors.description).toBeTruthy();
      expect(r.fieldErrors.amount).toBeTruthy();
    }
  });
  it("rechaza status inválido", () => {
    const r = validateChargeInput({
      supplier_id: "sup-1",
      description: "x",
      amount: 10,
      status: "zzz",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.fieldErrors.status).toBeTruthy();
  });
});

describe("validateCreditNoteInput", () => {
  it("acepta una nota válida", () => {
    const r = validateCreditNoteInput({
      charge_id: "ch-1",
      reason: "corrección sobrepeso",
      amount: "150",
      currency: "RMB",
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.input.amount).toBe(150);
  });
  it("rechaza sin charge_id, sin motivo, monto<=0", () => {
    const r = validateCreditNoteInput({ charge_id: "", reason: "", amount: 0 });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.fieldErrors.charge_id).toBeTruthy();
      expect(r.fieldErrors.reason).toBeTruthy();
      expect(r.fieldErrors.amount).toBeTruthy();
    }
  });
});

describe("validateConversionInput", () => {
  it("acepta conversión válida y deriva effective_rate de to/from si falta", () => {
    const r = validateConversionInput({
      from_currency: "USD",
      to_currency: "RMB",
      from_amount: "1000",
      to_amount: "7350",
      market_rate: "7.0",
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.input.effective_rate).toBeCloseTo(7.35, 4);
      expect(r.input.market_rate).toBe(7.0);
    }
  });
  it("rechaza monedas inválidas", () => {
    const r = validateConversionInput({
      from_currency: "RMB",
      to_currency: "VES",
      from_amount: 1,
      to_amount: 1,
      effective_rate: 1,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.fieldErrors.from_currency).toBeTruthy();
      expect(r.fieldErrors.to_currency).toBeTruthy();
    }
  });
  it("rechaza montos <= 0", () => {
    const r = validateConversionInput({
      from_currency: "USD",
      to_currency: "RMB",
      from_amount: 0,
      to_amount: -5,
      effective_rate: 7,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.fieldErrors.from_amount).toBeTruthy();
      expect(r.fieldErrors.to_amount).toBeTruthy();
    }
  });
});

describe("validateClaimOffsetInput", () => {
  it("acepta un cruce con cliente y monto", () => {
    const r = validateClaimOffsetInput({
      client_id: "cli-1",
      amount_usd: "300",
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.input.amount_usd).toBe(300);
  });
  it("rechaza sin cliente ni embarque", () => {
    const r = validateClaimOffsetInput({ amount_usd: 300 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.fieldErrors.client_id).toBeTruthy();
  });
  it("rechaza monto <= 0", () => {
    const r = validateClaimOffsetInput({ client_id: "cli-1", amount_usd: 0 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.fieldErrors.amount_usd).toBeTruthy();
  });
});
