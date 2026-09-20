// @vitest-environment node
/**
 * Tests de withholding-queries (SDD-0104 · Slice B).
 *
 * Cubre Acceptance §4.3:
 *  - listWithholdings filtra por período (eq) y mapea numeric string → number.
 *  - incluye anulados en la lista (para mostrarlos tachados)…
 *  - …pero withholdingTotals los EXCLUYE (solo cuenta 'emitido').
 *  - columnas seleccionadas ⊆ schema real de 0166 (anti falso-verde).
 */

import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  listWithholdings,
  withholdingTotals,
  WITHHOLDING_COLUMNS,
} from "../withholding-queries";
import type { TaxWithholding } from "../withholding-types";

const REAL_WITHHOLDING_COLUMNS = new Set([
  "id",
  "tenant_id",
  "withholding_type",
  "voucher_number",
  "period",
  "op_date",
  "supplier_id",
  "supplier_name",
  "rif",
  "source_bill_id",
  "source_doc",
  "base",
  "pct",
  "amount",
  "currency",
  "status",
  "notes",
  "created_by",
  "created_at",
  "updated_at",
  "voided_at",
  "voided_by",
]);

type Recorded = { eq: [string, unknown][]; selects: string[] };

/** Tope por request del doble de prueba: el `db-max-rows` de Supabase. */
const SERVER_CAP = 1000;

function stub(rows: Record<string, unknown>[]): {
  client: SupabaseClient;
  calls: Record<string, Recorded>;
} {
  const calls: Record<string, Recorded> = {};
  const client = {
    from(table: string) {
      calls[table] = calls[table] ?? { eq: [], selects: [] };
      const rec = calls[table];
      const listResult = { data: rows, error: null };
      const chain: Record<string, unknown> = {
        select: (cols?: string) => {
          if (typeof cols === "string") rec.selects.push(cols);
          return chain;
        },
        eq: (c: string, v: unknown) => (rec.eq.push([c, v]), chain),
        order: () => chain,
        limit: () => chain,
        // Se comporta como PostgREST de verdad: por más rango que se pida,
        // nunca devuelve más de SERVER_CAP filas. Sin esto el doble de prueba
        // sería más generoso que el servidor y el test saldría verde con
        // código que en producción trunca.
        range: (from: number, to: number) => {
          const pedido = to - from + 1;
          const trozo = Array.isArray(rows)
            ? rows.slice(from, from + Math.min(pedido, SERVER_CAP))
            : [];
          return {
            ...chain,
            then: (resolve: (v: { data: unknown; error: null }) => unknown) =>
              Promise.resolve({ data: trozo, error: null }).then(resolve),
          };
        },
        then: (resolve: (v: typeof listResult) => unknown) =>
          Promise.resolve(listResult).then(resolve),
      };
      return chain;
    },
  } as unknown as SupabaseClient;
  return { client, calls };
}

function topLevelColumns(select: string): string[] {
  return select.split(",").map((s) => s.trim()).filter(Boolean);
}

function row(over: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id: "w1",
    withholding_type: "iva",
    voucher_number: "V-1",
    period: "2026-06",
    op_date: "2026-06-10",
    supplier_id: null,
    supplier_name: "Proveedor X",
    rif: "J-1",
    source_bill_id: null,
    source_doc: "FAC-1",
    base: "160.00",
    pct: "75.000",
    amount: "120.00",
    currency: "USD",
    status: "emitido",
    notes: null,
    created_at: "2026-06-10T00:00:00Z",
    ...over,
  };
}

// ── columnas ⊆ schema real ─────────────────────────────────────
describe("WITHHOLDING_COLUMNS ⊆ schema 0166", () => {
  it("cada columna existe en tax_withholdings", () => {
    for (const c of topLevelColumns(WITHHOLDING_COLUMNS)) {
      expect(REAL_WITHHOLDING_COLUMNS.has(c)).toBe(true);
    }
  });
});

// ── listWithholdings ───────────────────────────────────────────
describe("listWithholdings", () => {
  it("filtra por período y mapea numeric → number", async () => {
    const { client, calls } = stub([row()]);
    const list = await listWithholdings(client, "2026-06");
    expect(calls.tax_withholdings.eq).toContainEqual(["period", "2026-06"]);
    expect(list).toHaveLength(1);
    expect(list[0].base).toBe(160);
    expect(typeof list[0].base).toBe("number");
    expect(list[0].pct).toBe(75);
    expect(list[0].amount).toBe(120);
    expect(list[0].withholdingType).toBe("iva");
  });

  it("incluye anulados en la lista (para mostrarlos tachados)", async () => {
    const { client } = stub([
      row({ id: "w1", status: "emitido" }),
      row({ id: "w2", status: "anulado" }),
    ]);
    const list = await listWithholdings(client, "2026-06");
    expect(list.map((r) => r.status)).toEqual(["emitido", "anulado"]);
  });
});

// ── withholdingTotals ──────────────────────────────────────────
describe("withholdingTotals · solo cuenta emitidos", () => {
  it("suma IVA e ISLR por separado", () => {
    const rows: TaxWithholding[] = [
      mapStubRow(row({ withholding_type: "iva", amount: "120.00", status: "emitido" })),
      mapStubRow(row({ withholding_type: "iva", amount: "30.00", status: "emitido" })),
      mapStubRow(row({ withholding_type: "islr", amount: "50.00", status: "emitido" })),
    ];
    const t = withholdingTotals(rows);
    expect(t.iva).toBe(150);
    expect(t.islr).toBe(50);
  });

  it("EXCLUYE los anulados de los totales", () => {
    const rows: TaxWithholding[] = [
      mapStubRow(row({ withholding_type: "iva", amount: "120.00", status: "emitido" })),
      mapStubRow(row({ withholding_type: "iva", amount: "999.00", status: "anulado" })),
      mapStubRow(row({ withholding_type: "islr", amount: "77.00", status: "anulado" })),
    ];
    const t = withholdingTotals(rows);
    expect(t.iva).toBe(120); // el anulado de 999 no cuenta
    expect(t.islr).toBe(0); // el único islr está anulado
  });

  it("lista vacía → 0/0", () => {
    expect(withholdingTotals([])).toEqual({ iva: 0, islr: 0 });
  });
});

/** Mapea una row cruda al tipo de dominio (usa el mismo mapeo que la query). */
function mapStubRow(r: Record<string, unknown>): TaxWithholding {
  return {
    id: String(r.id),
    withholdingType: r.withholding_type as "iva" | "islr",
    voucherNumber: String(r.voucher_number),
    period: String(r.period),
    opDate: String(r.op_date),
    supplierId: (r.supplier_id as string | null) ?? null,
    supplierName: String(r.supplier_name),
    rif: (r.rif as string | null) ?? null,
    sourceBillId: (r.source_bill_id as string | null) ?? null,
    sourceDoc: (r.source_doc as string | null) ?? null,
    base: Number(r.base),
    pct: Number(r.pct),
    amount: Number(r.amount),
    currency: String(r.currency),
    status: r.status as "emitido" | "anulado",
    notes: (r.notes as string | null) ?? null,
    createdAt: String(r.created_at),
  };
}
