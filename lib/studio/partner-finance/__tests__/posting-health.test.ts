/**
 * Tests del detector de salud contable (SDD-0110, fix auditor V6/V5).
 * `getPartnerFinanceHealth` cuenta los movimientos sin asiento (cargo /
 * conversión / cruce) y los cargos con asiento "stale" tras una nota de crédito.
 *
 * Stub chainable enrutado por tabla que soporta count/head + filtros
 * is/neq/gt/not, y las dos lecturas de la detección de stale.
 */

import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getPartnerFinanceHealth } from "../posting-health-queries";

type Row = Record<string, unknown>;
type Filter =
  | { kind: "is"; col: string; val: unknown }
  | { kind: "neq"; col: string; val: unknown }
  | { kind: "gt"; col: string; val: number }
  | { kind: "notNull"; col: string };

function matches(row: Row, filters: Filter[]): boolean {
  return filters.every((f) => {
    if (f.kind === "is") return f.val === null ? row[f.col] == null : row[f.col] === f.val;
    if (f.kind === "neq") return row[f.col] !== f.val;
    if (f.kind === "gt") return Number(row[f.col]) > f.val;
    if (f.kind === "notNull") return row[f.col] != null;
    return true;
  });
}

/** Tope por request del doble: el `db-max-rows` de Supabase. */
const SERVER_CAP = 1000;

function stub(tables: Record<string, Row[]>): SupabaseClient {
  return {
    from(table: string) {
      const rows = tables[table] ?? [];
      const filters: Filter[] = [];
      let headCount = false;

      const chain: Record<string, unknown> = {
        select(_cols: string, opts?: { count?: string; head?: boolean }) {
          if (opts?.head) headCount = true;
          return chain;
        },
        is(col: string, val: unknown) {
          filters.push({ kind: "is", col, val });
          return chain;
        },
        neq(col: string, val: unknown) {
          filters.push({ kind: "neq", col, val });
          return chain;
        },
        gt(col: string, val: number) {
          filters.push({ kind: "gt", col, val });
          return chain;
        },
        not(col: string) {
          // sólo usamos `.not(col, "is", null)` → col no nulo.
          filters.push({ kind: "notNull", col });
          return chain;
        },
        limit() {
          return chain;
        },
        // La paginación exige un orden estable, así que el código real ahora
        // encadena `.order("id")` — el doble tiene que aceptarlo.
        order() {
          return chain;
        },
        // Terminal paginado: corta en SERVER_CAP por request igual que
        // PostgREST. Un doble más generoso que el servidor deja pasar
        // código que en producción trunca — así sobrevivió este bug.
        range(desde: number, hasta: number) {
          const pedido = hasta - desde + 1;
          const todas = rows.filter((r) => matches(r, filters));
          const trozo = todas.slice(desde, desde + Math.min(pedido, SERVER_CAP));
          return Promise.resolve({ data: trozo, count: null, error: null });
        },
        then(resolve: (v: { data: Row[] | null; count: number | null; error: null }) => unknown) {
          const filtered = rows.filter((r) => matches(r, filters));
          return Promise.resolve({
            data: headCount ? null : filtered,
            count: headCount ? filtered.length : null,
            error: null,
          }).then(resolve);
        },
      };
      return chain;
    },
  } as unknown as SupabaseClient;
}

describe("getPartnerFinanceHealth", () => {
  it("cuenta cargos / conversiones / cruces sin asiento (excluye cancelado y comisión 0)", async () => {
    const s = stub({
      supplier_charges: [
        { id: "c1", journal_entry_id: null, deleted_at: null, status: "vigente" }, // hueco
        { id: "c2", journal_entry_id: null, deleted_at: null, status: "cancelado" }, // excluido
        { id: "c3", journal_entry_id: "je-1", deleted_at: null, status: "vigente" }, // asentado
        { id: "c4", journal_entry_id: null, deleted_at: "2026-01-01", status: "vigente" }, // borrado
      ],
      currency_conversions: [
        { id: "v1", journal_entry_id: null, deleted_at: null, commission_amount: 50 }, // hueco
        { id: "v2", journal_entry_id: null, deleted_at: null, commission_amount: 0 }, // sin spread, no hueco
      ],
      supplier_claim_offsets: [
        { id: "o1", journal_entry_id: null, deleted_at: null }, // hueco
        { id: "o2", journal_entry_id: "je-2", deleted_at: null }, // asentado
      ],
      supplier_credit_notes: [],
    });

    const h = await getPartnerFinanceHealth(s);
    expect(h.unpostedCharges).toBe(1);
    expect(h.unpostedConversions).toBe(1);
    expect(h.unpostedClaimOffsets).toBe(1);
    expect(h.staleCharges).toBe(0);
    expect(h.total).toBe(3);
  });

  it("detecta el asiento STALE (V5): cargo asentado con nota de crédito viva", async () => {
    const s = stub({
      supplier_charges: [
        { id: "c-stale", journal_entry_id: "je-9", deleted_at: null, status: "corregido" },
        { id: "c-ok", journal_entry_id: "je-10", deleted_at: null, status: "vigente" },
      ],
      currency_conversions: [],
      supplier_claim_offsets: [],
      supplier_credit_notes: [
        { charge_id: "c-stale", deleted_at: null }, // hace stale a c-stale
        { charge_id: "c-no-posteado", deleted_at: null }, // su cargo no está asentado → no cuenta
      ],
    });

    const h = await getPartnerFinanceHealth(s);
    expect(h.staleCharges).toBe(1);
    expect(h.total).toBe(1);
  });

  it("todo sano → total 0", async () => {
    const s = stub({
      supplier_charges: [{ id: "c", journal_entry_id: "je", deleted_at: null, status: "vigente" }],
      currency_conversions: [],
      supplier_claim_offsets: [],
      supplier_credit_notes: [],
    });
    const h = await getPartnerFinanceHealth(s);
    expect(h.total).toBe(0);
  });
});
