/**
 * Tests del módulo Cobranzas (SDD-0041) — capa pura.
 *
 * Cubre los criterios de aceptación de la sección 6 del spec:
 *  - receivablesQueue lista solo facturas con saldo>0 y status≠anulada,
 *    con aging correcto (vía buildReceivablesQueue + derivedStage).
 *  - validatePaymentInput rechaza amount≤0, amount>saldo y cuenta faltante.
 *  - postReceiptJournalEntry arma DR caja / CR 1.1.2 balanceado (buildReceiptLines
 *    + receiptAmountUsd, las partes puras sin DB).
 *  - formato next_receipt_code → R-YYYY-NNNN (formatReceiptCode + RECEIPT_CODE_RE).
 */

import { describe, it, expect } from "vitest";
import type { Account } from "../account-types";
import type { Invoice } from "../invoice-types";
import {
  buildReceivablesQueue,
  computeCollectionKpis,
  daysOverdue,
  derivedStage,
  isCashAccount,
} from "../payment-queries";
import {
  formatReceiptCode,
  RECEIPT_CODE_RE,
  validateActivityInput,
  validatePaymentInput,
  type CollectionActivity,
} from "../payment-types";
import {
  buildReceiptLines,
  receiptAmountUsd,
} from "../accounting/receipt-posting";

const TODAY = "2026-06-01";

function inv(partial: Partial<Invoice> & { id: string }): Invoice {
  return {
    tenant_id: "t1",
    invoice_code: "F-2026-0001",
    client_markbox: "DTD-1001",
    client_name: "Cliente Demo",
    shipment_id: null,
    shipment_code: null,
    currency: "USD",
    fx_rate: null,
    iva_rate: 0,
    base_amount: 0,
    iva_amount: 0,
    total_amount: 1000,
    status: "emitida",
    issued_at: "2026-04-01",
    due_date: "2026-05-01",
    paid_amount: 0,
    last_payment_at: null,
    lines: [],
    notes: null,
    created_at: "2026-04-01T00:00:00Z",
    updated_at: "2026-04-01T00:00:00Z",
    deleted_at: null,
    ...partial,
  };
}

function activity(
  partial: Partial<CollectionActivity> & { id: string; kind: CollectionActivity["kind"] },
): CollectionActivity {
  return {
    tenant_id: "t1",
    invoice_id: "i1",
    promised_amount: null,
    promised_date: null,
    next_followup: null,
    body: null,
    created_at: "2026-05-20T10:00:00Z",
    created_by: null,
    ...partial,
  };
}

// ── daysOverdue ───────────────────────────────────────────────
describe("daysOverdue", () => {
  it("positivo cuando la factura ya venció", () => {
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
  it("pagado cuando el saldo es 0 o menos", () => {
    expect(
      derivedStage({ balance: 0, dueDate: "2026-05-01", activities: [], today: TODAY }).stage,
    ).toBe("pagado");
  });

  it("vencido cuando due_date<hoy y no hubo gestión", () => {
    expect(
      derivedStage({ balance: 500, dueDate: "2026-05-01", activities: [], today: TODAY }).stage,
    ).toBe("vencido");
  });

  it("al-dia cuando aún no vence y no hubo gestión", () => {
    expect(
      derivedStage({ balance: 500, dueDate: "2026-06-30", activities: [], today: TODAY }).stage,
    ).toBe("al-dia");
  });

  it("promesa vigente cuando hay una promesa con fecha >= hoy", () => {
    const r = derivedStage({
      balance: 500,
      dueDate: "2026-05-01",
      activities: [activity({ id: "a1", kind: "promesa", promised_date: "2026-06-10" })],
      today: TODAY,
    });
    expect(r.stage).toBe("promesa");
    expect(r.promiseDate).toBe("2026-06-10");
  });

  it("promesa incumplida (fecha pasada) cae a contactado si vencida", () => {
    const r = derivedStage({
      balance: 500,
      dueDate: "2026-05-01",
      activities: [activity({ id: "a1", kind: "promesa", promised_date: "2026-05-15" })],
      today: TODAY,
    });
    expect(r.stage).toBe("contactado");
  });

  it("contactado cuando hubo contacto y la factura está vencida", () => {
    const r = derivedStage({
      balance: 500,
      dueDate: "2026-05-01",
      activities: [activity({ id: "a1", kind: "contacto" })],
      today: TODAY,
    });
    expect(r.stage).toBe("contactado");
  });
});

// ── buildReceivablesQueue (criterio: solo saldo>0, no anulada, aging) ──
describe("buildReceivablesQueue", () => {
  const invoices: Invoice[] = [
    inv({ id: "i1", invoice_code: "F-2026-0001", total_amount: 1000, paid_amount: 0, due_date: "2026-05-01" }), // vencida 31d
    inv({ id: "i2", invoice_code: "F-2026-0002", total_amount: 1000, paid_amount: 1000, status: "pagada" }), // saldo 0 → fuera
    inv({ id: "i3", invoice_code: "F-2026-0003", total_amount: 800, paid_amount: 300, due_date: "2026-06-20" }), // saldo 500, no vencida
    inv({ id: "i4", invoice_code: "F-2026-0004", total_amount: 500, paid_amount: 0, status: "anulada" }), // anulada → fuera
  ];

  const queue = buildReceivablesQueue(invoices, new Map(), TODAY);

  it("excluye facturas sin saldo (pagadas) y anuladas", () => {
    const codes = queue.map((r) => r.invoice.invoice_code);
    expect(codes).toContain("F-2026-0001");
    expect(codes).toContain("F-2026-0003");
    expect(codes).not.toContain("F-2026-0002");
    expect(codes).not.toContain("F-2026-0004");
    expect(queue).toHaveLength(2);
  });

  it("computa el saldo y el aging por receivable", () => {
    const r1 = queue.find((r) => r.invoice.invoice_code === "F-2026-0001")!;
    expect(r1.balance).toBe(1000);
    expect(r1.daysOverdue).toBe(31);
    expect(r1.stage).toBe("vencido");

    const r3 = queue.find((r) => r.invoice.invoice_code === "F-2026-0003")!;
    expect(r3.balance).toBe(500);
    expect(r3.stage).toBe("al-dia");
  });

  it("ordena por días vencido descendente (lo más atrasado arriba)", () => {
    expect(queue[0].invoice.invoice_code).toBe("F-2026-0001");
  });

  it("toma la última gestión y la promesa vigente del map", () => {
    const acts = new Map<string, CollectionActivity[]>([
      [
        "i3",
        [
          activity({ id: "a2", invoice_id: "i3", kind: "promesa", promised_date: "2026-06-25", created_at: "2026-05-25T00:00:00Z" }),
        ],
      ],
    ]);
    const q = buildReceivablesQueue(invoices, acts, TODAY);
    const r3 = q.find((r) => r.invoice.invoice_code === "F-2026-0003")!;
    expect(r3.stage).toBe("promesa");
    expect(r3.promiseDate).toBe("2026-06-25");
    expect(r3.lastActivity?.id).toBe("a2");
  });
});

// ── computeCollectionKpis ─────────────────────────────────────
describe("computeCollectionKpis", () => {
  const invoices: Invoice[] = [
    inv({ id: "i1", total_amount: 1000, paid_amount: 0, due_date: "2026-05-01" }), // vencida
    inv({ id: "i3", total_amount: 800, paid_amount: 300, due_date: "2026-06-20" }), // al día, saldo 500
  ];
  const kpis = computeCollectionKpis(buildReceivablesQueue(invoices, new Map(), TODAY));

  it("por cobrar = suma de saldos abiertos", () => {
    expect(kpis.porCobrar).toBe(1500);
  });
  it("vencido = saldo de las vencidas", () => {
    expect(kpis.vencido).toBe(1000);
  });
  it("casos = cantidad de facturas con saldo", () => {
    expect(kpis.casos).toBe(2);
  });
  it("tasa de cobro = % al día sobre el total", () => {
    // (1 - 1000/1500) * 100 = 33.33 → 33
    expect(kpis.tasaCobro).toBe(33);
  });
});

// ── validatePaymentInput (criterio: ≤0, >saldo, cuenta faltante) ──
describe("validatePaymentInput", () => {
  const valid = {
    amount: 500,
    cashAccountId: "acc-bank",
    method: "transferencia" as const,
    receivedAt: "2026-06-01",
    reference: "ZELLE-123",
    notes: null,
  };

  it("acepta input válido (amount ≤ saldo)", () => {
    const r = validatePaymentInput(valid, 1000);
    expect(r.fieldErrors).toBeUndefined();
    expect(r.input?.amount).toBe(500);
    expect(r.input?.cashAccountId).toBe("acc-bank");
    expect(r.input?.method).toBe("transferencia");
  });

  it("rechaza amount ≤ 0", () => {
    expect(validatePaymentInput({ ...valid, amount: 0 }, 1000).fieldErrors?.amount).toBeDefined();
    expect(validatePaymentInput({ ...valid, amount: -5 }, 1000).fieldErrors?.amount).toBeDefined();
  });

  it("rechaza amount > saldo", () => {
    const r = validatePaymentInput({ ...valid, amount: 1500 }, 1000);
    expect(r.fieldErrors?.amount).toBeDefined();
  });

  it("acepta amount == saldo (cobro total)", () => {
    const r = validatePaymentInput({ ...valid, amount: 1000 }, 1000);
    expect(r.fieldErrors).toBeUndefined();
  });

  it("rechaza cuenta de caja faltante", () => {
    const r = validatePaymentInput({ ...valid, cashAccountId: "" }, 1000);
    expect(r.fieldErrors?.cashAccountId).toBeDefined();
  });

  it("normaliza método desconocido a transferencia", () => {
    const r = validatePaymentInput(
      { ...valid, method: "bitcoin" as never },
      1000,
    );
    expect(r.input?.method).toBe("transferencia");
  });

  it("default de fecha cuando no se pasa", () => {
    const r = validatePaymentInput(
      { amount: 100, cashAccountId: "x" },
      1000,
    );
    expect(r.input?.receivedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("rechaza fecha con formato inválido", () => {
    const r = validatePaymentInput(
      { ...valid, receivedAt: "01/06/2026" },
      1000,
    );
    expect(r.fieldErrors?.receivedAt).toBeDefined();
  });
});

// ── validateActivityInput ─────────────────────────────────────
describe("validateActivityInput", () => {
  it("promesa requiere fecha comprometida", () => {
    const r = validateActivityInput({ kind: "promesa" });
    expect(r.fieldErrors?.promisedDate).toBeDefined();
  });
  it("promesa con fecha es válida", () => {
    const r = validateActivityInput({ kind: "promesa", promisedDate: "2026-06-10" });
    expect(r.fieldErrors).toBeUndefined();
    expect(r.input?.kind).toBe("promesa");
  });
  it("contacto no requiere fecha", () => {
    const r = validateActivityInput({ kind: "contacto", body: "Llamada" });
    expect(r.fieldErrors).toBeUndefined();
  });
});

// ── receiptAmountUsd + buildReceiptLines (asiento balanceado) ──
describe("receiptAmountUsd", () => {
  it("USD/USDT → amount tal cual", () => {
    expect(receiptAmountUsd(500, "USD")).toBe(500);
    expect(receiptAmountUsd(500, "USDT")).toBe(500);
  });
  it("VES con fx_rate → amount / fx_rate", () => {
    // 18000 VES a 36 VES/USD = 500 USD
    expect(receiptAmountUsd(18000, "VES", 36)).toBe(500);
  });
  it("sin fx_rate → amount tal cual (fallback)", () => {
    expect(receiptAmountUsd(500, "VES", null)).toBe(500);
  });
});

describe("buildReceiptLines (DR caja / CR 1.1.2 balanceado)", () => {
  const lines = buildReceiptLines("acc-bank", "acc-ar", 500);

  it("debita la cuenta de caja por el monto", () => {
    const cash = lines.find((l) => l.account_id === "acc-bank")!;
    expect(cash.debit).toBe(500);
    expect(cash.credit).toBe(0);
  });

  it("acredita la cuenta de clientes (1.1.2) por el monto", () => {
    const ar = lines.find((l) => l.account_id === "acc-ar")!;
    expect(ar.credit).toBe(500);
    expect(ar.debit).toBe(0);
  });

  it("el asiento balancea (Σ debe == Σ haber)", () => {
    const debit = lines.reduce((s, l) => s + l.debit, 0);
    const credit = lines.reduce((s, l) => s + l.credit, 0);
    expect(debit).toBe(credit);
    expect(debit).toBe(500);
  });

  it("son exactamente 2 líneas (debe XOR haber)", () => {
    expect(lines).toHaveLength(2);
    for (const l of lines) {
      expect(l.debit > 0 && l.credit > 0).toBe(false);
    }
  });
});

// ── isCashAccount (filtro del select de cuenta de caja/banco) ──
describe("isCashAccount", () => {
  const a = (
    code: string,
    qbo: string | null,
    postable: boolean,
  ): Pick<Account, "code" | "qbo_type" | "is_postable"> => ({
    code,
    qbo_type: qbo,
    is_postable: postable,
  });

  it("acepta cuentas postables con qbo_type='Bank'", () => {
    expect(isCashAccount(a("1.1.1.1", "Bank", true))).toBe(true);
  });
  it("acepta cuentas postables con code 1.1.1.*", () => {
    expect(isCashAccount(a("1.1.1.3", null, true))).toBe(true);
  });
  it("rechaza no postables (grupos)", () => {
    expect(isCashAccount(a("1.1.1", "Bank", false))).toBe(false);
  });
  it("rechaza cuentas que no son caja/banco (ej. CxC clientes)", () => {
    expect(isCashAccount(a("1.1.2", "Accounts receivable (A/R)", true))).toBe(false);
  });
});

// ── formatReceiptCode (criterio: R-YYYY-NNNN) ─────────────────
describe("formatReceiptCode", () => {
  it("formatea con padding de 4 dígitos", () => {
    expect(formatReceiptCode(2026, 1)).toBe("R-2026-0001");
    expect(formatReceiptCode(2026, 42)).toBe("R-2026-0042");
    expect(formatReceiptCode(2026, 1234)).toBe("R-2026-1234");
  });
  it("extiende el padding al pasar de 9999", () => {
    expect(formatReceiptCode(2026, 12345)).toBe("R-2026-12345");
  });
  it("el regex valida el formato producido", () => {
    expect(RECEIPT_CODE_RE.test(formatReceiptCode(2026, 1))).toBe(true);
    expect(RECEIPT_CODE_RE.test("F-2026-0001")).toBe(false);
    expect(RECEIPT_CODE_RE.test("R-2026-1")).toBe(false);
  });
});
