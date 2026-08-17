/**
 * Tests de queries de partner-finance (SDD-0059 · Slice A) con un stub
 * chainable de SupabaseClient que enruta por nombre de tabla.
 *
 * Cubre:
 *  - getPartnerBalance / listLedgerEntries: coerción numeric→number + saldo neto.
 *  - listCharges / getChargeWithNet: net_amount derivado de notas de crédito.
 *  - transitionChargeStatus: guard de transición inválida (no toca DB).
 *  - addConversion: persiste spread/comisión computados.
 *  - transitionClaimOffset: guard lineal + sella fecha-hito.
 */

import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getPartnerBalance, listLedgerEntries } from "../ledger-queries";
import {
  getChargeWithNet,
  listCharges,
  transitionChargeStatus,
} from "../charges-queries";
import { addConversion } from "../conversions-queries";
import { transitionClaimOffset } from "../claim-offsets-queries";

// ── Stub chainable enrutado por tabla ─────────────────────────
type Tables = Record<string, Record<string, unknown>[]>;

/** Captura de los inserts/updates que el código ejecuta (para asserts). */
type Captured = {
  inserts: { table: string; payload: Record<string, unknown> }[];
  updates: { table: string; payload: Record<string, unknown> }[];
};

/** Tope por request del doble: el `db-max-rows` de Supabase. */
const SERVER_CAP = 1000;

function stub(
  tables: Tables,
  captured?: Captured,
  rpc?: (name: string) => unknown,
): SupabaseClient {
  return {
    rpc(name: string) {
      return Promise.resolve({ data: rpc ? rpc(name) : "PLE-2026-0001", error: null });
    },
    from(table: string) {
      const rows = tables[table] ?? [];
      let pendingInsert: Record<string, unknown> | null = null;
      let pendingUpdate: Record<string, unknown> | null = null;
      let single = false;

      const chain: Record<string, unknown> = {
        select() {
          return chain;
        },
        order() {
          return chain;
        },
        limit() {
          return chain;
        },
        // Terminal paginado: corta en SERVER_CAP por request igual que
        // PostgREST. Un doble más generoso que el servidor deja pasar
        // código que en producción trunca — así sobrevivió este bug.
        range(desde: number, hasta: number) {
          const pedido = hasta - desde + 1;
          const todas = rows;
          const trozo = todas.slice(desde, desde + Math.min(pedido, SERVER_CAP));
          return Promise.resolve({ data: trozo, count: null, error: null });
        },
        eq() {
          return chain;
        },
        in() {
          return chain;
        },
        is() {
          return chain;
        },
        insert(payload: Record<string, unknown>) {
          pendingInsert = payload;
          captured?.inserts.push({ table, payload });
          return chain;
        },
        update(payload: Record<string, unknown>) {
          pendingUpdate = payload;
          captured?.updates.push({ table, payload });
          return chain;
        },
        single() {
          single = true;
          // devuelve la fila "creada" (merge del payload con un id)
          return Promise.resolve({
            data: { id: "new-id", ...(pendingInsert ?? {}) },
            error: null,
          });
        },
        maybeSingle() {
          return Promise.resolve({ data: rows[0] ?? null, error: null });
        },
        then(resolve: (v: { data: unknown; error: null }) => unknown) {
          // update sin select → resuelve { data:null }
          if (pendingUpdate && !single) {
            return Promise.resolve({ data: null, error: null }).then(resolve);
          }
          return Promise.resolve({ data: rows, error: null }).then(resolve);
        },
      };
      return chain;
    },
  } as unknown as SupabaseClient;
}

// ── Ledger ────────────────────────────────────────────────────
describe("getPartnerBalance", () => {
  it("deriva el saldo neto desde las entries (numeric como string)", async () => {
    const s = stub({
      partner_ledger_entries: [
        { direction: "haber", amount_usd: "1000.00", amount_rmb: "7000.00", deleted_at: null },
        { direction: "debe", amount_usd: "400.00", amount_rmb: "2800.00", deleted_at: null },
        { direction: "haber", amount_usd: "9999", amount_rmb: "0", deleted_at: "2026-01-01" },
      ],
    });
    const b = await getPartnerBalance(s, "sup-1");
    expect(b.net_usd).toBe(600);
    expect(b.net_rmb).toBe(4200);
    expect(b.entry_count).toBe(2); // soft-deleted excluido
  });
});

describe("listLedgerEntries", () => {
  it("coacciona numeric a number", async () => {
    const s = stub({
      partner_ledger_entries: [
        {
          id: "e1",
          tenant_id: "t1",
          supplier_id: "sup-1",
          entry_code: "PLE-2026-0001",
          entry_type: "costo_contenedor",
          direction: "haber",
          amount_usd: "1200.50",
          amount_rmb: "8400.00",
          fx_rate: "7.00",
          currency_paid: "USD",
          occurred_on: "2026-03-01",
        },
      ],
    });
    const entries = await listLedgerEntries(s, "sup-1");
    expect(entries).toHaveLength(1);
    expect(entries[0].amount_usd).toBe(1200.5);
    expect(entries[0].fx_rate).toBe(7);
  });
});

// ── Charges + net_amount ──────────────────────────────────────
describe("listCharges (net_amount derivado)", () => {
  it("descuenta las notas de crédito vivas del bruto", async () => {
    const s = stub({
      supplier_charges: [
        {
          id: "ch-1",
          tenant_id: "t1",
          supplier_id: "sup-1",
          container_id: null,
          description: "超重 Overweight",
          description_cn: null,
          amount: "200.00",
          currency: "RMB",
          fx_rate: null,
          charged_on: "2026-03-01",
          status: "disputado",
          reconciled: false,
          statement_line_id: null,
        },
      ],
      supplier_credit_notes: [
        { charge_id: "ch-1", amount: "150.00", deleted_at: null },
      ],
    });
    const charges = await listCharges(s, "sup-1");
    expect(charges).toHaveLength(1);
    expect(charges[0].amount).toBe(200);
    expect(charges[0].credited).toBe(150);
    expect(charges[0].net_amount).toBe(50);
  });

  it("sin cargos → array vacío (no consulta notas)", async () => {
    const s = stub({ supplier_charges: [] });
    const charges = await listCharges(s);
    expect(charges).toEqual([]);
  });
});

describe("getChargeWithNet", () => {
  it("net = amount − Σ notas; null si no existe", async () => {
    const s = stub({
      supplier_charges: [
        {
          id: "ch-1",
          tenant_id: "t1",
          supplier_id: "sup-1",
          container_id: null,
          description: "x",
          description_cn: null,
          amount: "1000.00",
          currency: "USD",
          fx_rate: null,
          charged_on: "2026-03-01",
          status: "vigente",
          reconciled: false,
          statement_line_id: null,
        },
      ],
      supplier_credit_notes: [
        { amount: "100.00", deleted_at: null },
        { amount: "50.00", deleted_at: null },
      ],
    });
    const c = await getChargeWithNet(s, "ch-1");
    expect(c?.net_amount).toBe(850);

    const missing = await getChargeWithNet(stub({ supplier_charges: [] }), "x");
    expect(missing).toBeNull();
  });
});

describe("transitionChargeStatus (guard)", () => {
  it("rechaza una transición inválida sin tocar la DB", async () => {
    const captured: Captured = { inserts: [], updates: [] };
    const s = stub({ supplier_charges: [] }, captured);
    await expect(
      transitionChargeStatus(s, "ch-1", "vigente", "corregido"),
    ).rejects.toThrow(/inválida/);
    expect(captured.updates).toHaveLength(0);
  });

  it("aplica una transición válida", async () => {
    const captured: Captured = { inserts: [], updates: [] };
    const s = stub({ supplier_charges: [] }, captured);
    await transitionChargeStatus(s, "ch-1", "vigente", "disputado");
    expect(captured.updates).toHaveLength(1);
    expect(captured.updates[0].payload.status).toBe("disputado");
  });
});

// ── Conversion: persiste spread/comisión ──────────────────────
describe("addConversion", () => {
  it("computa y persiste spread_pct + commission_amount", async () => {
    const captured: Captured = { inserts: [], updates: [] };
    const s = stub({ currency_conversions: [] }, captured);
    await addConversion(s, "t1", {
      from_currency: "USD",
      to_currency: "RMB",
      from_amount: 1000,
      to_amount: 7350,
      effective_rate: 7.35,
      market_rate: 7.0,
      commission_amount: null,
      shipment_id: null,
      client_id: null,
      converted_on: null,
      notes: null,
    });
    expect(captured.inserts).toHaveLength(1);
    const payload = captured.inserts[0].payload;
    expect(payload.spread_pct).toBeCloseTo(5, 4);
    expect(payload.commission_amount).toBe(50);
  });
});

// ── Claim offset transición ───────────────────────────────────
describe("transitionClaimOffset (guard lineal + fecha-hito)", () => {
  it("rechaza un salto", async () => {
    const captured: Captured = { inserts: [], updates: [] };
    const s = stub({ supplier_claim_offsets: [] }, captured);
    await expect(
      transitionClaimOffset(s, "cl-1", "reclamado", "pagado_en_china"),
    ).rejects.toThrow(/inválida/);
    expect(captured.updates).toHaveLength(0);
  });

  it("avanza un paso y sella la fecha-hito", async () => {
    const captured: Captured = { inserts: [], updates: [] };
    const s = stub({ supplier_claim_offsets: [] }, captured);
    await transitionClaimOffset(
      s,
      "cl-1",
      "reconocido_proveedor",
      "pagado_en_china",
      { stageDate: "2026-04-01" },
    );
    expect(captured.updates).toHaveLength(1);
    const p = captured.updates[0].payload;
    expect(p.status).toBe("pagado_en_china");
    expect(p.received_in_china_on).toBe("2026-04-01");
  });

  it("al aplicar a cliente guarda client_invoice_id", async () => {
    const captured: Captured = { inserts: [], updates: [] };
    const s = stub({ supplier_claim_offsets: [] }, captured);
    await transitionClaimOffset(
      s,
      "cl-1",
      "pagado_en_china",
      "aplicado_a_cliente",
      { clientInvoiceId: "inv-9" },
    );
    const p = captured.updates[0].payload;
    expect(p.client_invoice_id).toBe("inv-9");
    expect(p.applied_to_client_on).toBeTruthy();
  });
});
