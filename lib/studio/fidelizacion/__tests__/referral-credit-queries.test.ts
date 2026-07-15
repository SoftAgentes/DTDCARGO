/**
 * Tests de las queries del crédito de referido aplicado (SDD-0137).
 *
 * - getReferralCreditMode: lee fiscal_settings.referral_credit_mode; cae al
 *   default 'marketing_expense' si no hay row o el valor es inválido.
 * - applicableInvoicesForReferrer: filtra facturas billable USD/USDT con
 *   total ≥ crédito del referidor (client-side sobre lo que la DB devuelve).
 *
 * Stub de SupabaseClient chainable con select/eq/in/order/limit/maybeSingle
 * + resolución como promise (then).
 */

import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  applicableInvoicesForReferrer,
  getReferralCreditMode,
  isPurchaseAfterCredit,
  requireReferralCreditMode,
  toCalendarDay,
} from "../referral-credit-queries";

/** Filtros que el stub vio en la última query (para afirmar sobre ellos). */
let lastFilters: { op: string; col: string; val: unknown }[] = [];

function stub(rowsByTable: Record<string, Record<string, unknown>[] | Record<string, unknown> | null>): SupabaseClient {
  return {
    from(table: string) {
      const value = rowsByTable[table];
      const chain: Record<string, unknown> = {
        select() {
          return chain;
        },
        eq() {
          return chain;
        },
        in(col: string, val: unknown) {
          lastFilters.push({ op: "in", col, val });
          return chain;
        },
        // NO es un no-op: registra el corte de fecha para poder afirmar que el
        // picker lo manda como día (YYYY-MM-DD) y no como timestamptz crudo —
        // mandarlo crudo era lo que hacía divergir al picker de la action.
        gte(col: string, val: unknown) {
          lastFilters.push({ op: "gte", col, val });
          return chain;
        },
        order() {
          return chain;
        },
        limit() {
          return chain;
        },
        maybeSingle() {
          // maybeSingle → un solo objeto (o null)
          const data = Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
          return Promise.resolve({ data, error: null });
        },
        then(resolve: (v: { data: unknown; error: null }) => unknown) {
          const data = Array.isArray(value) ? value : [];
          return Promise.resolve({ data, error: null }).then(resolve);
        },
      };
      return chain;
    },
  } as unknown as SupabaseClient;
}

/** Stub que simula un FALLO de lectura (RLS, columna faltante, timeout). */
function errorStub(error: { code?: string; message: string }): SupabaseClient {
  return {
    from() {
      const chain: Record<string, unknown> = {
        select() {
          return chain;
        },
        eq() {
          return chain;
        },
        maybeSingle() {
          return Promise.resolve({ data: null, error });
        },
      };
      return chain;
    },
  } as unknown as SupabaseClient;
}

/** El camino de dinero exige tenantId explícito (service_role bypassa RLS). */
const TENANT = "11111111-1111-1111-1111-111111111111";

/** Forma REAL de referrals.accredited_at (timestamptz vía PostgREST). */
const ACCREDITED = "2026-01-01T09:30:00+00:00";

describe("requireReferralCreditMode (camino de DINERO · falla cerrado)", () => {
  it("devuelve el modo configurado", async () => {
    const client = stub({ fiscal_settings: { referral_credit_mode: "commercial_discount" } });
    expect(await requireReferralCreditMode(client, TENANT)).toEqual({
      ok: true,
      mode: "commercial_discount",
    });
  });

  it("sin row de config fiscal → default legítimo (el tenant nunca configuró)", async () => {
    const client = stub({ fiscal_settings: null });
    expect(await requireReferralCreditMode(client, TENANT)).toEqual({
      ok: true,
      mode: "marketing_expense",
    });
  });

  it("columna en null → default legítimo", async () => {
    const client = stub({ fiscal_settings: { referral_credit_mode: null } });
    expect(await requireReferralCreditMode(client, TENANT)).toEqual({
      ok: true,
      mode: "marketing_expense",
    });
  });

  it("ERROR de lectura → NO adivina (si adivinara, asentaría contra la cuenta equivocada)", async () => {
    const client = errorStub({ code: "42703", message: "column does not exist" });
    const res = await requireReferralCreditMode(client, TENANT);
    expect(res.ok).toBe(false);
    expect(res.ok === false && res.error).toMatch(/no se pudo leer el modo fiscal/i);
  });

  it("error transitorio (timeout/RLS) tampoco cae al default", async () => {
    const client = errorStub({ message: "canceling statement due to statement timeout" });
    expect((await requireReferralCreditMode(client, TENANT)).ok).toBe(false);
  });

  it("valor no reconocido → NO adivina (alguien guardó basura en el setting)", async () => {
    const client = stub({ fiscal_settings: { referral_credit_mode: "otra_cosa" } });
    const res = await requireReferralCreditMode(client, TENANT);
    expect(res.ok).toBe(false);
    expect(res.ok === false && res.error).toMatch(/no reconocido/i);
  });
});

describe("getReferralCreditMode", () => {
  it("degrada al default ante error de lectura (es solo para PINTAR, no debe tumbar la página)", async () => {
    const client = errorStub({ code: "42703", message: "column does not exist" });
    expect(await getReferralCreditMode(client)).toBe("marketing_expense");
  });

  it("lee el modo configurado en fiscal_settings", async () => {
    const client = stub({ fiscal_settings: { referral_credit_mode: "commercial_discount" } });
    expect(await getReferralCreditMode(client)).toBe("commercial_discount");
  });

  it("cae al default marketing_expense si no hay row", async () => {
    const client = stub({ fiscal_settings: null });
    expect(await getReferralCreditMode(client)).toBe("marketing_expense");
  });

  it("cae al default si el valor guardado es inválido", async () => {
    const client = stub({ fiscal_settings: { referral_credit_mode: "otra_cosa" } });
    expect(await getReferralCreditMode(client)).toBe("marketing_expense");
  });
});

describe("applicableInvoicesForReferrer", () => {
  // La DB ya filtra status/currency (in()); acá probamos el filtro de SALDO ≥ crédito
  // y la coerción numérica del stub (devolvemos filas ya "billable USD/USDT").
  const rows = [
    { id: "i1", invoice_code: "F-1", client_markbox: "DTD-5452", currency: "USD", total_amount: "120", paid_amount: 0, status: "emitida", issued_at: "2026-01-01" },
    { id: "i2", invoice_code: "F-2", client_markbox: "DTD-5452", currency: "USDT", total_amount: 80, paid_amount: 0, status: "parcial", issued_at: "2026-02-01" },
    { id: "i3", invoice_code: "F-3", client_markbox: "DTD-5452", currency: "USD", total_amount: 50, paid_amount: 0, status: "vencida", issued_at: "2026-03-01" },
  ];

  it("mantiene solo las facturas con SALDO ≥ crédito", async () => {
    const client = stub({ invoices: rows });
    const res = await applicableInvoicesForReferrer(client, "DTD-5452", 80, ACCREDITED);
    expect(res.map((i) => i.invoice_code)).toEqual(["F-1", "F-2"]); // 120 y 80 pasan; 50 no
    expect(res[0].total_amount).toBe(120); // coerción de string a number
    expect(res[0].balance).toBe(120);
  });

  it("Fix A (over-credit): una 'parcial' con saldo < crédito se EXCLUYE aunque su total ≥ crédito", async () => {
    // total 100, ya pagó 95 → saldo 5. El crédito de $80 la dejaría en CxC negativa.
    const parcialCasiPaga = [
      { id: "p1", invoice_code: "F-P", client_markbox: "DTD-9", currency: "USD", total_amount: 100, paid_amount: 95, status: "parcial", issued_at: "2026-01-01" },
    ];
    const client = stub({ invoices: parcialCasiPaga });
    const res = await applicableInvoicesForReferrer(client, "DTD-9", 80, ACCREDITED);
    expect(res).toEqual([]); // saldo 5 < 80 → fuera (antes pasaba por total 100 ≥ 80)
  });

  it("expone paid_amount y balance = total − pagado", async () => {
    const parcial = [
      { id: "p2", invoice_code: "F-Q", client_markbox: "DTD-9", currency: "USD", total_amount: 200, paid_amount: 40, status: "parcial", issued_at: "2026-01-01" },
    ];
    const client = stub({ invoices: parcial });
    const res = await applicableInvoicesForReferrer(client, "DTD-9", 80, ACCREDITED);
    expect(res).toHaveLength(1);
    expect(res[0].paid_amount).toBe(40);
    expect(res[0].balance).toBe(160); // 200 − 40; saldo 160 ≥ 80 → adentro
  });

  it("sin markbox → lista vacía sin consultar", async () => {
    const client = stub({ invoices: rows });
    const res = await applicableInvoicesForReferrer(client, "", 80, ACCREDITED);
    expect(res).toEqual([]);
  });

  it("si ninguna alcanza el monto → vacío (el crédito espera)", async () => {
    const client = stub({ invoices: rows });
    const res = await applicableInvoicesForReferrer(client, "DTD-5452", 500, ACCREDITED);
    expect(res).toEqual([]);
  });
});

describe("isPurchaseAfterCredit · regla del founder (compra NUEVA, no abono a deuda vieja)", () => {
  // Tipos REALES (verificados en prod 2026-07-15):
  //   invoices.issued_at      = date        → "2026-07-01"
  //   referrals.accredited_at = timestamptz → "2026-07-01T00:00:00+00:00"
  const ACRED = "2026-06-01T09:30:00+00:00";

  it("MISMO DÍA que la acreditación → elegible (la compra nueva puede facturarse ese día)", () => {
    // Comparar los crudos como strings daría false ("2026-06-01" < "2026-06-01T09:30…"),
    // rechazando una factura legítima. Ese era el bug.
    expect(isPurchaseAfterCredit("2026-06-01", ACRED)).toBe(true);
  });

  it("posterior → elegible", () => {
    expect(isPurchaseAfterCredit("2026-07-01", ACRED)).toBe(true);
  });

  it("ANTERIOR → NO elegible (es deuda que ya existía cuando nació el crédito)", () => {
    expect(isPurchaseAfterCredit("2026-05-31", ACRED)).toBe(false);
  });

  it("sin fecha de emisión → NO elegible (no se puede probar que sea posterior)", () => {
    expect(isPurchaseAfterCredit(null, ACRED)).toBe(false);
  });

  it("sin fecha de acreditación → NO elegible (fail-closed: es dinero)", () => {
    expect(isPurchaseAfterCredit("2026-07-01", null)).toBe(false);
  });

  it("basura en cualquier lado → NO elegible", () => {
    expect(isPurchaseAfterCredit("no-es-fecha", ACRED)).toBe(false);
    expect(isPurchaseAfterCredit("2026-07-01", "nada")).toBe(false);
  });

  it("tolera ambas formas de PostgREST (date y timestamptz) en cualquier lado", () => {
    expect(toCalendarDay("2026-07-01")).toBe("2026-07-01");
    expect(toCalendarDay("2026-07-01T00:00:00+00:00")).toBe("2026-07-01");
    expect(toCalendarDay(null)).toBeNull();
  });
});

describe("applicableInvoicesForReferrer · corte por fecha (el picker)", () => {
  const rows = [
    { id: "i1", invoice_code: "F-1", client_markbox: "DTD-5452", currency: "USD", total_amount: 120, paid_amount: 0, status: "emitida", issued_at: "2026-02-01" },
  ];

  it("manda el corte a la DB como DÍA (no el timestamptz crudo) → picker y action coinciden", async () => {
    lastFilters = [];
    const client = stub({ invoices: rows });
    await applicableInvoicesForReferrer(client, "DTD-5452", 80, "2026-01-01T09:30:00+00:00");

    const gte = lastFilters.find((f) => f.op === "gte" && f.col === "issued_at");
    expect(gte).toBeDefined();
    // Mandar "2026-01-01T09:30:00+00:00" hacía que el picker ofreciera facturas que
    // la action después rechazaba (callejón sin salida en la UI).
    expect(gte!.val).toBe("2026-01-01");
  });

  it("sin fecha de acreditación → [] y NI SIQUIERA consulta (fail-closed)", async () => {
    lastFilters = [];
    const client = stub({ invoices: rows });
    const res = await applicableInvoicesForReferrer(client, "DTD-5452", 80, null);

    expect(res).toEqual([]);
    expect(lastFilters).toHaveLength(0);
  });
});
