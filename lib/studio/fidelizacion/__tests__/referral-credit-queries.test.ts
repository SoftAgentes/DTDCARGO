/**
 * Tests de las queries del crédito de referido aplicado (SDD-0137).
 *
 * ⚠️ Ya no se testea ningún "modo fiscal": ese setting se descartó (el módulo
 * Fiscal está apagado y nada se ata a él, founder 2026-07-15).
 *
 * - applicableInvoicesForReferrer: filtra facturas billable USD/USDT con
 *   total ≥ crédito del referidor (client-side sobre lo que la DB devuelve).
 *
 * Stub de SupabaseClient chainable con select/eq/in/order/limit/maybeSingle
 * + resolución como promise (then).
 */

import { describe, it, expect, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  applicableInvoicesForReferrer,
  isPurchaseAfterCredit,
  toCalendarDay,
} from "../referral-credit-queries";

/** Filtros que el stub vio en la última query (para afirmar sobre ellos). */
let lastFilters: { op: string; col: string; val: unknown }[] = [];

// Reset global: era module-level con reset a mano dentro de 2 tests → un test nuevo
// que afirmara sin resetear heredaba basura y podía dar falso verde.
beforeEach(() => {
  lastFilters = [];
});

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

/** Forma REAL de referrals.accredited_at (timestamptz vía PostgREST). */
const ACCREDITED = "2026-01-01T09:30:00+00:00";

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
    const client = stub({ invoices: rows });
    await applicableInvoicesForReferrer(client, "DTD-5452", 80, "2026-01-01T09:30:00+00:00");

    const gte = lastFilters.find((f) => f.op === "gte" && f.col === "issued_at");
    expect(gte).toBeDefined();
    // Mandar "2026-01-01T09:30:00+00:00" hacía que el picker ofreciera facturas que
    // la action después rechazaba (callejón sin salida en la UI).
    expect(gte!.val).toBe("2026-01-01");
  });

  it("EXCLUYE del RESULTADO una factura anterior al crédito (no solo del filtro SQL)", async () => {
    // El stub NO filtra: devuelve todo, como haría una DB que ignorara el .gte().
    // Así se prueba que el picker no depende SOLO del SQL — el post-filtro con el
    // helper compartido es lo que garantiza que jamás ofrezca algo que la action
    // después rechace.
    const client = stub({
      invoices: [
        { id: "vieja", invoice_code: "F-VIEJA", client_markbox: "DTD-5452", currency: "USD", total_amount: 500, paid_amount: 0, status: "emitida", issued_at: "2025-12-01" },
        { id: "nueva", invoice_code: "F-NUEVA", client_markbox: "DTD-5452", currency: "USD", total_amount: 500, paid_amount: 0, status: "emitida", issued_at: "2026-02-01" },
      ],
    });
    const res = await applicableInvoicesForReferrer(client, "DTD-5452", 80, ACCREDITED);

    expect(res.map((i) => i.invoice_code)).toEqual(["F-NUEVA"]);
  });

  it("sin fecha de acreditación → [] y NI SIQUIERA consulta (fail-closed)", async () => {
    const client = stub({ invoices: rows });
    const res = await applicableInvoicesForReferrer(client, "DTD-5452", 80, null);

    expect(res).toEqual([]);
    expect(lastFilters).toHaveLength(0);
  });
});
