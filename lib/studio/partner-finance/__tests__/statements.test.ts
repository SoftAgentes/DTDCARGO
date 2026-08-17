/**
 * Tests de statements-queries (SDD-0059 · Slice B1) con un stub chainable de
 * SupabaseClient enrutado por nombre de tabla (mismo patrón que queries.test.ts
 * de Slice A), extendido para insert→select que devuelve ARRAY (addStatementLines).
 *
 * Cubre:
 *  - createStatement: persiste cabecera con status 'importado'.
 *  - addStatementLines: lote en sin_match; no-op con lista vacía.
 *  - getStatementWithLines: cabecera + líneas; null si no existe.
 *  - applyMatchDecision: persiste match_status + ids + confianza; limpia el id no usado.
 *  - closeStatement: marca reconciled en los cargos atados + cierra el estado.
 */

import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createStatement,
  addStatementLines,
  getStatementWithLines,
  applyMatchDecision,
  closeStatement,
  listStatements,
} from "../statements-queries";

type Tables = Record<string, Record<string, unknown>[]>;

type Captured = {
  inserts: { table: string; payload: unknown }[];
  updates: { table: string; payload: Record<string, unknown> }[];
};

/**
 * Stub: por tabla, mantiene rows. `insert().select()` resuelto vía `then`
 * devuelve el payload (array si era array, o [payload]); `insert().select().single()`
 * devuelve la fila con id. `select()...` sin insert devuelve rows.
 */
/** Tope por request del doble: el `db-max-rows` de Supabase. */
const SERVER_CAP = 1000;

function stub(tables: Tables, captured?: Captured): SupabaseClient {
  return {
    rpc() {
      return Promise.resolve({ data: null, error: null });
    },
    from(table: string) {
      const rows = tables[table] ?? [];
      let pendingInsert: unknown = null;
      let pendingUpdate: Record<string, unknown> | null = null;

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
        insert(payload: unknown) {
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
          const base = Array.isArray(pendingInsert)
            ? (pendingInsert[0] as Record<string, unknown>)
            : ((pendingInsert as Record<string, unknown>) ?? {});
          return Promise.resolve({
            data: { id: "new-id", ...base },
            error: null,
          });
        },
        maybeSingle() {
          return Promise.resolve({ data: rows[0] ?? null, error: null });
        },
        then(resolve: (v: { data: unknown; error: null }) => unknown) {
          if (pendingInsert != null) {
            // insert().select() → devuelve el/los payload con id sintético
            const arr = Array.isArray(pendingInsert)
              ? (pendingInsert as Record<string, unknown>[]).map((p, i) => ({
                  id: `new-${i}`,
                  ...p,
                }))
              : [{ id: "new-id", ...(pendingInsert as Record<string, unknown>) }];
            return Promise.resolve({ data: arr, error: null }).then(resolve);
          }
          if (pendingUpdate) {
            return Promise.resolve({ data: null, error: null }).then(resolve);
          }
          return Promise.resolve({ data: rows, error: null }).then(resolve);
        },
      };
      return chain;
    },
  } as unknown as SupabaseClient;
}

// ── createStatement ───────────────────────────────────────────
describe("createStatement", () => {
  it("persiste la cabecera con status 'importado'", async () => {
    const captured: Captured = { inserts: [], updates: [] };
    const s = stub({ partner_statements: [] }, captured);
    const out = await createStatement(s, "t1", {
      supplier_id: "sup-1",
      period_label: "2026-Q1",
      source_file_document_id: null,
      total_usd: 12000,
      total_rmb: 84000,
    });
    expect(captured.inserts).toHaveLength(1);
    const payload = captured.inserts[0].payload as Record<string, unknown>;
    expect(payload.tenant_id).toBe("t1");
    expect(payload.supplier_id).toBe("sup-1");
    expect(payload.status).toBe("importado");
    expect(payload.period_label).toBe("2026-Q1");
    expect(out.total_usd).toBe(12000);
  });
});

// ── addStatementLines ─────────────────────────────────────────
describe("addStatementLines", () => {
  it("inserta el lote con match_status sin_match", async () => {
    const captured: Captured = { inserts: [], updates: [] };
    const s = stub({ partner_statement_lines: [] }, captured);
    const out = await addStatementLines(s, "t1", "st-1", [
      {
        raw_description: "ocean freight",
        raw_description_cn: "海运费",
        amount: 1000,
        currency: "USD",
        line_date: "2026-03-01",
      },
      {
        raw_description: "overweight",
        raw_description_cn: "超重",
        amount: 200,
        currency: "RMB",
        line_date: null,
      },
    ]);
    expect(captured.inserts).toHaveLength(1);
    const payload = captured.inserts[0].payload as Record<string, unknown>[];
    expect(payload).toHaveLength(2);
    expect(payload[0].statement_id).toBe("st-1");
    expect(payload[0].tenant_id).toBe("t1");
    expect(payload[0].match_status).toBe("sin_match");
    expect(payload[1].match_status).toBe("sin_match");
    expect(out).toHaveLength(2);
    expect(out[0].amount).toBe(1000);
  });

  it("no-op con lista vacía (no toca la DB)", async () => {
    const captured: Captured = { inserts: [], updates: [] };
    const s = stub({ partner_statement_lines: [] }, captured);
    const out = await addStatementLines(s, "t1", "st-1", []);
    expect(out).toEqual([]);
    expect(captured.inserts).toHaveLength(0);
  });
});

// ── listStatements ────────────────────────────────────────────
describe("listStatements", () => {
  it("coacciona totals numeric→number", async () => {
    const s = stub({
      partner_statements: [
        {
          id: "st-1",
          tenant_id: "t1",
          supplier_id: "sup-1",
          period_label: "2026-Q1",
          imported_at: "2026-03-01",
          source_file_document_id: null,
          total_usd: "12000.00",
          total_rmb: "84000.00",
          status: "importado",
        },
      ],
    });
    const out = await listStatements(s, "sup-1");
    expect(out).toHaveLength(1);
    expect(out[0].total_usd).toBe(12000);
    expect(out[0].total_rmb).toBe(84000);
  });
});

// ── getStatementWithLines ─────────────────────────────────────
describe("getStatementWithLines", () => {
  it("devuelve cabecera + líneas", async () => {
    const s = stub({
      partner_statements: [
        {
          id: "st-1",
          tenant_id: "t1",
          supplier_id: "sup-1",
          period_label: "2026-Q1",
          imported_at: "2026-03-01",
          source_file_document_id: null,
          total_usd: "1000.00",
          total_rmb: "0",
          status: "reconciliando",
        },
      ],
      partner_statement_lines: [
        {
          id: "ln-1",
          tenant_id: "t1",
          statement_id: "st-1",
          raw_description: "freight",
          raw_description_cn: null,
          amount: "1000.00",
          currency: "USD",
          line_date: "2026-03-01",
          match_status: "match_auto",
          matched_charge_id: "ch-1",
          matched_ledger_entry_id: null,
          match_confidence: "alta",
          note: null,
        },
      ],
    });
    const out = await getStatementWithLines(s, "st-1");
    expect(out).not.toBeNull();
    expect(out?.total_usd).toBe(1000);
    expect(out?.lines).toHaveLength(1);
    expect(out?.lines[0].amount).toBe(1000);
    expect(out?.lines[0].matched_charge_id).toBe("ch-1");
  });

  it("null si el estado no existe", async () => {
    const s = stub({ partner_statements: [] });
    const out = await getStatementWithLines(s, "nope");
    expect(out).toBeNull();
  });
});

// ── applyMatchDecision ────────────────────────────────────────
describe("applyMatchDecision", () => {
  it("persiste match contra cargo y deja la entry en null", async () => {
    const captured: Captured = { inserts: [], updates: [] };
    const s = stub({ partner_statement_lines: [] }, captured);
    await applyMatchDecision(s, "ln-1", {
      match_status: "match_manual",
      matched_charge_id: "ch-9",
      match_confidence: "media",
      note: "atado a mano",
    });
    expect(captured.updates).toHaveLength(1);
    const p = captured.updates[0].payload;
    expect(p.match_status).toBe("match_manual");
    expect(p.matched_charge_id).toBe("ch-9");
    expect(p.matched_ledger_entry_id).toBeNull();
    expect(p.match_confidence).toBe("media");
    expect(p.note).toBe("atado a mano");
  });

  it("una discrepancia sin ids deja ambos en null y confianza null", async () => {
    const captured: Captured = { inserts: [], updates: [] };
    const s = stub({ partner_statement_lines: [] }, captured);
    await applyMatchDecision(s, "ln-2", { match_status: "discrepancia" });
    const p = captured.updates[0].payload;
    expect(p.match_status).toBe("discrepancia");
    expect(p.matched_charge_id).toBeNull();
    expect(p.matched_ledger_entry_id).toBeNull();
    expect(p.match_confidence).toBeNull();
  });
});

// ── closeStatement ────────────────────────────────────────────
describe("closeStatement", () => {
  it("marca reconciled en los cargos atados y cierra el estado", async () => {
    const captured: Captured = { inserts: [], updates: [] };
    const s = stub(
      {
        // líneas con dos cargos distintos (uno repetido + uno null)
        partner_statement_lines: [
          { matched_charge_id: "ch-1" },
          { matched_charge_id: "ch-2" },
          { matched_charge_id: "ch-1" },
          { matched_charge_id: null },
        ],
      },
      captured,
    );
    await closeStatement(s, "st-1");

    // un update marca reconciled (en supplier_charges), otro cierra el estado.
    const chargeUpd = captured.updates.find(
      (u) => u.table === "supplier_charges",
    );
    const stmtUpd = captured.updates.find(
      (u) => u.table === "partner_statements",
    );
    expect(chargeUpd?.payload.reconciled).toBe(true);
    expect(stmtUpd?.payload.status).toBe("cerrado");
  });

  it("sin cargos atados → sólo cierra el estado (no toca supplier_charges)", async () => {
    const captured: Captured = { inserts: [], updates: [] };
    const s = stub(
      { partner_statement_lines: [{ matched_charge_id: null }] },
      captured,
    );
    await closeStatement(s, "st-2");
    const chargeUpd = captured.updates.find(
      (u) => u.table === "supplier_charges",
    );
    const stmtUpd = captured.updates.find(
      (u) => u.table === "partner_statements",
    );
    expect(chargeUpd).toBeUndefined();
    expect(stmtUpd?.payload.status).toBe("cerrado");
  });

  it("guard server-side: rechaza cerrar si quedan líneas a revisar (match_auto)", async () => {
    const captured: Captured = { inserts: [], updates: [] };
    const s = stub(
      {
        partner_statement_lines: [
          { match_status: "match_manual", matched_charge_id: "ch-1" },
          // sugerencia auto sin confirmar → "a revisar" → bloquea el cierre.
          { match_status: "match_auto", matched_charge_id: "ch-2" },
        ],
      },
      captured,
    );
    await expect(closeStatement(s, "st-3")).rejects.toThrow(/a revisar/i);
    // No debe haber cerrado el estado ni tocado los cargos.
    expect(captured.updates).toHaveLength(0);
  });
});
