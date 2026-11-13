/**
 * Tests del módulo Tesorería (SDD-0044) — capa pura.
 *
 * Cubre los criterios de aceptación de la sección 6 del spec:
 *  - buildPayablesQueue lista solo CxP con saldo>0 y status≠anulada, con aging
 *    y stage correctos (derivedStage + daysOverdue).
 *  - computeTreasuryKpis (porPagar/vencido/pagadoMes/proveedoresActivos).
 *  - validateBillInput rechaza total≤0, proveedor/cuenta de gasto/venc. faltantes.
 *  - validatePaymentInput rechaza amount≤0, amount>saldo y cuenta faltante.
 *  - postBillJournalEntry arma DR gasto / CR 2.1.1 balanceado (buildBillLines
 *    + billAmountUsd, partes puras sin DB).
 *  - postSupplierPaymentJournalEntry arma DR 2.1.1 / CR caja balanceado.
 *  - isExpenseAccount (filtro del select de cuenta de gasto).
 *  - isChinaRemittance (remesas a China).
 *  - formato de los códigos PRV-/CXP-/OP-.
 */

import { describe, it, expect } from "vitest";
import type { Account } from "../../account-types";
import {
  buildPayablesQueue,
  computeTreasuryKpis,
  daysOverdue,
  derivedStage,
  isExpenseAccount,
} from "../bill-queries";
import {
  BILL_CODE_RE,
  formatBillCode,
  formatPaymentOrderCode,
  formatSupplierCode,
  isChinaRemittance,
  PAYMENT_CODE_RE,
  SUPPLIER_CODE_RE,
  validateBillInput,
  validatePaymentInput,
  validateSupplierInput,
  type SupplierBill,
} from "../types";
import { billAmountUsd, buildBillLines } from "../../accounting/bill-posting";
import {
  buildSupplierPaymentLines,
  paymentAmountUsd,
} from "../../accounting/supplier-payment-posting";

const TODAY = "2026-06-01";

function bill(partial: Partial<SupplierBill> & { id: string }): SupplierBill {
  return {
    tenant_id: "t1",
    bill_code: "CXP-2026-0001",
    supplier_id: "s1",
    supplier_name: "Proveedor Demo",
    concept: "Flete",
    expense_account_id: "acc-exp",
    currency: "USD",
    fx_rate: null,
    total_amount: 1000,
    paid_amount: 0,
    status: "pendiente",
    bill_kind: "full",
    issue_date: "2026-04-01",
    due_date: "2026-05-01",
    reference: null,
    shipment_id: null,
    journal_entry_id: null,
    notes: null,
    created_at: "2026-04-01T00:00:00Z",
    updated_at: "2026-04-01T00:00:00Z",
    deleted_at: null,
    ...partial,
  };
}

// ── daysOverdue ───────────────────────────────────────────────
describe("daysOverdue", () => {
  it("positivo cuando la CxP ya venció", () => {
    expect(daysOverdue("2026-05-01", TODAY)).toBe(31);
  });
  it("negativo cuando aún falta para el vencimiento", () => {
    expect(daysOverdue("2026-06-11", TODAY)).toBe(-10);
  });
  it("0 cuando vence hoy", () => {
    expect(daysOverdue("2026-06-01", TODAY)).toBe(0);
  });
  it("null sin due_date", () => {
    expect(daysOverdue(null, TODAY)).toBeNull();
  });
});

// ── derivedStage ──────────────────────────────────────────────
describe("derivedStage", () => {
  it("pagada cuando el saldo es 0 o menos", () => {
    expect(
      derivedStage({
        totalAmount: 1000,
        paidAmount: 1000,
        balance: 0,
        dueDate: "2026-05-01",
        today: TODAY,
      }),
    ).toBe("pagada");
  });
  it("vencida cuando due_date<hoy con saldo", () => {
    expect(
      derivedStage({
        totalAmount: 1000,
        paidAmount: 0,
        balance: 1000,
        dueDate: "2026-05-01",
        today: TODAY,
      }),
    ).toBe("vencida");
  });
  it("parcial cuando hubo pago, no vencida", () => {
    expect(
      derivedStage({
        totalAmount: 1000,
        paidAmount: 300,
        balance: 700,
        dueDate: "2026-06-30",
        today: TODAY,
      }),
    ).toBe("parcial");
  });
  it("por_vencer cuando hay saldo, no vencida, sin pagos", () => {
    expect(
      derivedStage({
        totalAmount: 1000,
        paidAmount: 0,
        balance: 1000,
        dueDate: "2026-06-30",
        today: TODAY,
      }),
    ).toBe("por_vencer");
  });
  it("vencida gana sobre parcial cuando ya venció", () => {
    expect(
      derivedStage({
        totalAmount: 1000,
        paidAmount: 300,
        balance: 700,
        dueDate: "2026-05-01",
        today: TODAY,
      }),
    ).toBe("vencida");
  });
});

// ── buildPayablesQueue (criterio: solo saldo>0, no anulada, aging) ──
describe("buildPayablesQueue", () => {
  const bills: SupplierBill[] = [
    bill({ id: "b1", bill_code: "CXP-2026-0001", total_amount: 1000, paid_amount: 0, due_date: "2026-05-01" }), // vencida 31d
    bill({ id: "b2", bill_code: "CXP-2026-0002", total_amount: 1000, paid_amount: 1000, status: "pagada", due_date: "2026-05-15" }), // saldo 0 → fuera
    bill({ id: "b3", bill_code: "CXP-2026-0003", total_amount: 800, paid_amount: 300, due_date: "2026-06-20", status: "parcial" }), // saldo 500, no vencida
    bill({ id: "b4", bill_code: "CXP-2026-0004", total_amount: 500, paid_amount: 0, status: "anulada", due_date: "2026-05-10" }), // anulada → fuera
  ];

  const queue = buildPayablesQueue(bills, TODAY);

  it("excluye CxP sin saldo (pagadas) y anuladas", () => {
    const codes = queue.map((p) => p.bill.bill_code);
    expect(codes).toContain("CXP-2026-0001");
    expect(codes).toContain("CXP-2026-0003");
    expect(codes).not.toContain("CXP-2026-0002");
    expect(codes).not.toContain("CXP-2026-0004");
    expect(queue).toHaveLength(2);
  });

  it("computa el saldo y el aging por payable", () => {
    const p1 = queue.find((p) => p.bill.bill_code === "CXP-2026-0001")!;
    expect(p1.balance).toBe(1000);
    expect(p1.daysOverdue).toBe(31);
    expect(p1.stage).toBe("vencida");

    const p3 = queue.find((p) => p.bill.bill_code === "CXP-2026-0003")!;
    expect(p3.balance).toBe(500);
    expect(p3.stage).toBe("parcial");
  });

  it("ordena por días vencido descendente (lo más atrasado arriba)", () => {
    expect(queue[0].bill.bill_code).toBe("CXP-2026-0001");
  });
});

// ── computeTreasuryKpis ───────────────────────────────────────
describe("computeTreasuryKpis", () => {
  const bills: SupplierBill[] = [
    bill({ id: "b1", supplier_id: "s1", total_amount: 1000, paid_amount: 0, due_date: "2026-05-01" }), // vencida
    bill({ id: "b3", supplier_id: "s2", total_amount: 800, paid_amount: 300, due_date: "2026-06-20", status: "parcial" }), // por vencer, saldo 500
  ];
  const queue = buildPayablesQueue(bills, TODAY);
  const payments = [
    { amount: 250, paid_at: "2026-06-10" }, // dentro del mes
    { amount: 100, paid_at: "2026-05-30" }, // mes anterior → fuera
  ];
  const kpis = computeTreasuryKpis(queue, payments, TODAY);

  it("por pagar = suma de saldos abiertos", () => {
    expect(kpis.porPagar).toBe(1500);
  });
  it("vencido = saldo de las vencidas", () => {
    expect(kpis.vencido).toBe(1000);
  });
  it("pagado mes = solo pagos del mes en curso", () => {
    expect(kpis.pagadoMes).toBe(250);
  });
  it("proveedores activos = distintos con saldo", () => {
    expect(kpis.proveedoresActivos).toBe(2);
  });
});

// ── validateSupplierInput ─────────────────────────────────────
describe("validateSupplierInput", () => {
  it("rechaza nombre faltante", () => {
    expect(validateSupplierInput({ name: "" }).fieldErrors?.name).toBeDefined();
  });
  it("acepta nombre + normaliza type/moneda desconocidos", () => {
    const r = validateSupplierInput({
      name: "Maersk",
      type: "xxx" as never,
      defaultCurrency: "BTC" as never,
    });
    expect(r.fieldErrors).toBeUndefined();
    expect(r.input?.type).toBe("proveedor_cn");
    expect(r.input?.defaultCurrency).toBe("USD");
    expect(r.input?.country).toBe("CN");
  });
});

// ── validateBillInput (criterio: total≤0, proveedor/gasto/venc faltantes) ──
describe("validateBillInput", () => {
  const valid = {
    supplierId: "s1",
    expenseAccountId: "acc-exp",
    currency: "USD" as const,
    totalAmount: 1200,
    issueDate: "2026-06-01",
    dueDate: "2026-07-01",
    concept: "Flete",
    fxRate: null,
    reference: null,
    shipmentId: null,
    notes: null,
  };

  it("acepta input válido", () => {
    const r = validateBillInput(valid);
    expect(r.fieldErrors).toBeUndefined();
    expect(r.input?.totalAmount).toBe(1200);
    expect(r.input?.supplierId).toBe("s1");
  });
  it("rechaza total ≤ 0", () => {
    expect(validateBillInput({ ...valid, totalAmount: 0 }).fieldErrors?.totalAmount).toBeDefined();
    expect(validateBillInput({ ...valid, totalAmount: -5 }).fieldErrors?.totalAmount).toBeDefined();
  });
  it("rechaza proveedor faltante", () => {
    expect(validateBillInput({ ...valid, supplierId: "" }).fieldErrors?.supplierId).toBeDefined();
  });
  it("rechaza cuenta de gasto faltante", () => {
    expect(validateBillInput({ ...valid, expenseAccountId: "" }).fieldErrors?.expenseAccountId).toBeDefined();
  });
  it("rechaza vencimiento faltante", () => {
    expect(validateBillInput({ ...valid, dueDate: "" }).fieldErrors?.dueDate).toBeDefined();
  });
  it("rechaza vencimiento con formato inválido", () => {
    expect(validateBillInput({ ...valid, dueDate: "01/07/2026" }).fieldErrors?.dueDate).toBeDefined();
  });
  it("conserva fx_rate solo si es > 0", () => {
    expect(validateBillInput({ ...valid, currency: "VES", fxRate: 36.5 }).input?.fxRate).toBe(36.5);
    expect(validateBillInput({ ...valid, fxRate: 0 }).input?.fxRate).toBeNull();
  });
});

// ── validatePaymentInput (criterio: ≤0, >saldo, cuenta faltante) ──
describe("validatePaymentInput", () => {
  const valid = {
    amount: 500,
    cashAccountId: "acc-bank",
    method: "transferencia" as const,
    paidAt: "2026-06-01",
    reference: "TRX-1",
    notes: null,
  };

  it("acepta input válido (amount ≤ saldo)", () => {
    const r = validatePaymentInput(valid, 1000);
    expect(r.fieldErrors).toBeUndefined();
    expect(r.input?.amount).toBe(500);
    expect(r.input?.method).toBe("transferencia");
  });
  it("rechaza amount ≤ 0", () => {
    expect(validatePaymentInput({ ...valid, amount: 0 }, 1000).fieldErrors?.amount).toBeDefined();
    expect(validatePaymentInput({ ...valid, amount: -5 }, 1000).fieldErrors?.amount).toBeDefined();
  });
  it("rechaza amount > saldo", () => {
    expect(validatePaymentInput({ ...valid, amount: 1500 }, 1000).fieldErrors?.amount).toBeDefined();
  });
  it("acepta amount == saldo (pago total)", () => {
    expect(validatePaymentInput({ ...valid, amount: 1000 }, 1000).fieldErrors).toBeUndefined();
  });
  // SDD-0489: la regla estricta de Cobranzas (SDD-0488). Antes pasaba 0,01 de más.
  it("rechaza un centavo por encima del saldo", () => {
    expect(validatePaymentInput({ ...valid, amount: 1000.01 }, 1000).fieldErrors?.amount).toBeDefined();
    expect(validatePaymentInput({ ...valid, amount: 400.01 }, 400).fieldErrors?.amount).toBeDefined();
    expect(validatePaymentInput({ ...valid, amount: 400.01 }, 400.01).fieldErrors).toBeUndefined();
  });
  it("rechaza cuenta de caja faltante", () => {
    expect(validatePaymentInput({ ...valid, cashAccountId: "" }, 1000).fieldErrors?.cashAccountId).toBeDefined();
  });
  it("normaliza método desconocido a transferencia", () => {
    expect(validatePaymentInput({ ...valid, method: "bitcoin" as never }, 1000).input?.method).toBe("transferencia");
  });
  it("acepta método remesa_china", () => {
    expect(validatePaymentInput({ ...valid, method: "remesa_china" }, 1000).input?.method).toBe("remesa_china");
  });
  it("default de fecha cuando no se pasa", () => {
    expect(validatePaymentInput({ amount: 100, cashAccountId: "x" }, 1000).input?.paidAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

// ── billAmountUsd + buildBillLines (DR gasto / CR 2.1.1) ───────
describe("billAmountUsd", () => {
  it("USD/USDT → amount tal cual", () => {
    expect(billAmountUsd(500, "USD")).toBe(500);
    expect(billAmountUsd(500, "USDT")).toBe(500);
  });
  it("CNY con fx_rate → amount / fx_rate", () => {
    // 3600 CNY a 7.2 CNY/USD = 500 USD
    expect(billAmountUsd(3600, "CNY", 7.2)).toBe(500);
  });
  // SDD-0572 (decisión 1 de Sam; el Director, 2026-10-20): sin tasa no se convierte; nunca el monto tal cual.
  it("sin fx_rate → null (la CxP no se asienta)", () => {
    expect(billAmountUsd(500, "VES", null)).toBeNull();
    expect(billAmountUsd(500, "CNY", undefined)).toBeNull();
  });
});

describe("buildBillLines (DR gasto / CR 2.1.1 balanceado)", () => {
  const lines = buildBillLines("acc-exp", "acc-ap", 1200);

  it("debita la cuenta de gasto por el monto", () => {
    const exp = lines.find((l) => l.account_id === "acc-exp")!;
    expect(exp.debit).toBe(1200);
    expect(exp.credit).toBe(0);
  });
  it("acredita la cuenta de proveedores (2.1.1) por el monto", () => {
    const ap = lines.find((l) => l.account_id === "acc-ap")!;
    expect(ap.credit).toBe(1200);
    expect(ap.debit).toBe(0);
  });
  it("el asiento balancea (Σ debe == Σ haber)", () => {
    const debit = lines.reduce((s, l) => s + l.debit, 0);
    const credit = lines.reduce((s, l) => s + l.credit, 0);
    expect(debit).toBe(credit);
    expect(debit).toBe(1200);
  });
  it("son exactamente 2 líneas (debe XOR haber)", () => {
    expect(lines).toHaveLength(2);
    for (const l of lines) {
      expect(l.debit > 0 && l.credit > 0).toBe(false);
    }
  });
});

// ── paymentAmountUsd + buildSupplierPaymentLines (DR 2.1.1 / CR caja) ──
describe("paymentAmountUsd", () => {
  it("USD/USDT → amount tal cual", () => {
    expect(paymentAmountUsd(500, "USD")).toBe(500);
    expect(paymentAmountUsd(500, "USDT")).toBe(500);
  });
  it("VES con fx_rate → amount / fx_rate", () => {
    expect(paymentAmountUsd(18000, "VES", 36)).toBe(500);
  });
});

describe("buildSupplierPaymentLines (DR 2.1.1 / CR caja balanceado)", () => {
  const lines = buildSupplierPaymentLines("acc-ap", "acc-bank", 500);

  it("debita la cuenta de proveedores (2.1.1) por el monto", () => {
    const ap = lines.find((l) => l.account_id === "acc-ap")!;
    expect(ap.debit).toBe(500);
    expect(ap.credit).toBe(0);
  });
  it("acredita la cuenta de caja por el monto", () => {
    const cash = lines.find((l) => l.account_id === "acc-bank")!;
    expect(cash.credit).toBe(500);
    expect(cash.debit).toBe(0);
  });
  it("el asiento balancea (Σ debe == Σ haber)", () => {
    const debit = lines.reduce((s, l) => s + l.debit, 0);
    const credit = lines.reduce((s, l) => s + l.credit, 0);
    expect(debit).toBe(credit);
    expect(debit).toBe(500);
  });
});

// ── isExpenseAccount (filtro del select de cuenta de gasto) ────
describe("isExpenseAccount", () => {
  const a = (
    code: string,
    qbo: string | null,
    postable: boolean,
  ): Pick<Account, "code" | "qbo_type" | "is_postable"> => ({
    code,
    qbo_type: qbo,
    is_postable: postable,
  });

  it("acepta postable Cost of Goods Sold", () => {
    expect(isExpenseAccount(a("5.1", "Cost of Goods Sold", true))).toBe(true);
  });
  it("acepta postable Expense", () => {
    expect(isExpenseAccount(a("6.5.1", "Expense", true))).toBe(true);
  });
  it("acepta postable por code 5.* / 6.*", () => {
    expect(isExpenseAccount(a("5.2", null, true))).toBe(true);
    expect(isExpenseAccount(a("6.99", null, true))).toBe(true);
  });
  it("rechaza no postables (grupos)", () => {
    expect(isExpenseAccount(a("5", "Cost of Goods Sold", false))).toBe(false);
  });
  it("rechaza cuentas que no son gasto (ej. caja)", () => {
    expect(isExpenseAccount(a("1.1.1.1", "Bank", true))).toBe(false);
  });
});

// ── isChinaRemittance ─────────────────────────────────────────
describe("isChinaRemittance", () => {
  it("método usdt / remesa_china / alipay", () => {
    expect(isChinaRemittance("usdt", "USD")).toBe(true);
    expect(isChinaRemittance("remesa_china", "USD")).toBe(true);
    expect(isChinaRemittance("alipay", "USD")).toBe(true);
  });
  it("moneda CNY / USDT", () => {
    expect(isChinaRemittance("transferencia", "CNY")).toBe(true);
    expect(isChinaRemittance("transferencia", "USDT")).toBe(true);
  });
  it("transferencia en USD/VES no es remesa", () => {
    expect(isChinaRemittance("transferencia", "USD")).toBe(false);
    expect(isChinaRemittance("transferencia", "VES")).toBe(false);
  });
});

// ── formato de los códigos PRV-/CXP-/OP- ──────────────────────
describe("formatos de código", () => {
  it("supplier_code PRV-NNNN", () => {
    expect(formatSupplierCode(1)).toBe("PRV-0001");
    expect(formatSupplierCode(42)).toBe("PRV-0042");
    expect(SUPPLIER_CODE_RE.test(formatSupplierCode(1))).toBe(true);
    expect(SUPPLIER_CODE_RE.test("CXP-2026-0001")).toBe(false);
  });
  it("bill_code CXP-YYYY-NNNN", () => {
    expect(formatBillCode(2026, 1)).toBe("CXP-2026-0001");
    expect(formatBillCode(2026, 12345)).toBe("CXP-2026-12345");
    expect(BILL_CODE_RE.test(formatBillCode(2026, 1))).toBe(true);
    expect(BILL_CODE_RE.test("OP-2026-0001")).toBe(false);
  });
  it("payment_code OP-YYYY-NNNN", () => {
    expect(formatPaymentOrderCode(2026, 1)).toBe("OP-2026-0001");
    expect(PAYMENT_CODE_RE.test(formatPaymentOrderCode(2026, 7))).toBe(true);
    expect(PAYMENT_CODE_RE.test("PRV-0001")).toBe(false);
  });
});
