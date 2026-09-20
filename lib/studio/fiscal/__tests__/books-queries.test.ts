// @vitest-environment node
/**
 * Tests de books-queries (SDD-0104 · Slice A).
 *
 * Cubre Acceptance §4.3:
 *  - getPostedBook trae la cabecera VIGENTE (status='asentado') + sus líneas
 *    ordenadas por line_no; null si no hay asiento vigente.
 *  - status='asentado' se exige en el filtro (un anulado no es el vigente).
 *  - columnas seleccionadas ⊆ schema real de 0165 (anti falso-verde).
 *  - numeric string → number; currencies array → array; null base → null (no 0).
 *
 * Stub chainable que enruta por tabla, registra eq()/order()/select() y expone
 * maybeSingle() + thenable (mismo patrón que queries.test.ts).
 */

import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getPostedBook,
  listPostedBooks,
  FISCAL_BOOK_COLUMNS,
  FISCAL_BOOK_ENTRY_COLUMNS,
} from "../books-queries";

// Columnas reales de 0165 (verificadas contra la migración). Si books-queries
// selecciona algo que NO está acá, el test de schema falla.
const REAL_FISCAL_BOOK_COLUMNS = new Set([
  "id",
  "tenant_id",
  "period",
  "book_type",
  "status",
  "total_base",
  "total_iva",
  "total_total",
  "total_base_exenta",
  "total_base_gravada",
  "total_base_tasa_cero",
  "row_count",
  "currencies",
  "default_iva_mode",
  "posted_at",
  "posted_by",
  "voided_at",
  "voided_by",
  "void_reason",
  "created_at",
]);

const REAL_FISCAL_BOOK_ENTRY_COLUMNS = new Set([
  "id",
  "book_id",
  "tenant_id",
  "line_no",
  "op_date",
  "document_number",
  "control_number",
  "rif",
  "party_name",
  "iva_class",
  "base",
  "rate",
  "iva",
  "total",
  "retention",
  "currency",
  "source_type",
  "source_ref",
  "created_at",
]);

type Recorded = { eq: [string, unknown][]; selects: string[] };

/** Tope por request del doble de prueba: el `db-max-rows` de Supabase. */
const SERVER_CAP = 1000;

function stub(rowsByTable: Record<string, Record<string, unknown>[] | null>): {
  client: SupabaseClient;
  calls: Record<string, Recorded>;
} {
  const calls: Record<string, Recorded> = {};

  const client = {
    from(table: string) {
      const rows = rowsByTable[table] ?? [];
      calls[table] = calls[table] ?? { eq: [], selects: [] };
      const rec = calls[table];
      const listResult = { data: rows, error: null };
      const single = {
        data: Array.isArray(rows) ? (rows[0] ?? null) : null,
        error: null,
      };

      const chain: Record<string, unknown> = {
        select: (cols?: string) => {
          if (typeof cols === "string") rec.selects.push(cols);
          return chain;
        },
        eq: (c: string, v: unknown) => (rec.eq.push([c, v]), chain),
        order: () => chain,
        limit: () => chain,
        maybeSingle: () => Promise.resolve(single),
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
  return select
    .replace(/\w+\([^)]*\)/g, "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

// ── columnas ⊆ schema real (anti falso-verde) ──────────────────
describe("columnas seleccionadas existen en el schema 0165", () => {
  it("FISCAL_BOOK_COLUMNS ⊆ fiscal_books", () => {
    for (const c of topLevelColumns(FISCAL_BOOK_COLUMNS)) {
      expect(REAL_FISCAL_BOOK_COLUMNS.has(c)).toBe(true);
    }
  });
  it("FISCAL_BOOK_ENTRY_COLUMNS ⊆ fiscal_book_entries", () => {
    for (const c of topLevelColumns(FISCAL_BOOK_ENTRY_COLUMNS)) {
      expect(REAL_FISCAL_BOOK_ENTRY_COLUMNS.has(c)).toBe(true);
    }
  });
});

// ── getPostedBook ──────────────────────────────────────────────
describe("getPostedBook", () => {
  it("exige status='asentado' (el vigente) + period + book_type en el filtro", async () => {
    const { client, calls } = stub({ fiscal_books: [] });
    const res = await getPostedBook(client, "2026-06", "ventas");
    expect(res).toBeNull(); // no hay asiento vigente
    expect(calls.fiscal_books.eq).toContainEqual(["status", "asentado"]);
    expect(calls.fiscal_books.eq).toContainEqual(["period", "2026-06"]);
    expect(calls.fiscal_books.eq).toContainEqual(["book_type", "ventas"]);
  });

  it("trae la cabecera vigente + líneas ordenadas, coerciona numeric y null", async () => {
    const { client, calls } = stub({
      fiscal_books: [
        {
          id: "book-1",
          period: "2026-06",
          book_type: "ventas",
          status: "asentado",
          total_base: "1500.00",
          total_iva: "240.00",
          total_total: "1740.00",
          total_base_exenta: "0",
          total_base_gravada: "1500.00",
          total_base_tasa_cero: "0",
          row_count: "2",
          currencies: ["USD"],
          default_iva_mode: "con_iva",
          posted_at: "2026-07-01T10:00:00Z",
          posted_by: "u1",
          voided_at: null,
          voided_by: null,
          void_reason: null,
        },
      ],
      fiscal_book_entries: [
        {
          id: "e1",
          line_no: "1",
          op_date: "2026-06-10",
          document_number: "F-2026-0001",
          control_number: null,
          rif: "J-1",
          party_name: "Cliente A",
          iva_class: "gravada",
          base: "1000.00",
          rate: "16.000",
          iva: "160.00",
          total: "1160.00",
          retention: null,
          currency: "USD",
          source_type: "invoice",
          source_ref: "F-2026-0001",
        },
        {
          id: "e2",
          line_no: "2",
          op_date: "2026-06-12",
          document_number: "F-2026-0002",
          control_number: null,
          rif: null,
          party_name: "Cliente B",
          iva_class: "gravada",
          base: "500.00",
          rate: "16.000",
          iva: "80.00",
          total: "580.00",
          retention: null,
          currency: "USD",
          source_type: "invoice",
          source_ref: "F-2026-0002",
        },
      ],
    });

    const book = await getPostedBook(client, "2026-06", "ventas");
    expect(book).not.toBeNull();
    expect(book!.id).toBe("book-1");
    expect(book!.status).toBe("asentado");
    expect(book!.totalBase).toBe(1500);
    expect(typeof book!.totalBase).toBe("number");
    expect(book!.totalIva).toBe(240);
    expect(book!.rowCount).toBe(2);
    expect(book!.currencies).toEqual(["USD"]);
    expect(book!.entries).toHaveLength(2);
    expect(book!.entries[0].lineNo).toBe(1);
    expect(book!.entries[0].base).toBe(1000);
    expect(book!.entries[0].rate).toBe(16);
    // null base/retention → null, no 0 (no fabrica).
    expect(book!.entries[0].controlNumber).toBeNull();
    expect(book!.entries[0].retention).toBeNull();
    // las líneas se piden por book_id de la cabecera.
    expect(calls.fiscal_book_entries.eq).toContainEqual(["book_id", "book-1"]);
  });

  it("base null en una línea → null en TS (cero fabricado out)", async () => {
    const { client } = stub({
      fiscal_books: [
        {
          id: "book-2",
          period: "2026-06",
          book_type: "compras",
          status: "asentado",
          total_base: "0",
          total_iva: "0",
          total_total: "500.00",
          total_base_exenta: "0",
          total_base_gravada: "0",
          total_base_tasa_cero: "0",
          row_count: "1",
          currencies: ["USD"],
          default_iva_mode: "sin_iva",
          posted_at: "2026-07-01T10:00:00Z",
          posted_by: "u1",
          voided_at: null,
          voided_by: null,
          void_reason: null,
        },
      ],
      fiscal_book_entries: [
        {
          id: "e1",
          line_no: "1",
          op_date: "2026-06-10",
          document_number: "FAC-998",
          control_number: null,
          rif: "J-PRV-1",
          party_name: "Proveedor X",
          iva_class: null,
          base: null,
          rate: null,
          iva: null,
          total: "500.00",
          retention: null,
          currency: "USD",
          source_type: "bill",
          source_ref: "FAC-998",
        },
      ],
    });
    const book = await getPostedBook(client, "2026-06", "compras");
    expect(book!.entries[0].base).toBeNull();
    expect(book!.entries[0].iva).toBeNull();
    expect(book!.entries[0].total).toBe(500);
    expect(book!.entries[0].ivaClass).toBeNull();
  });
});

// ── listPostedBooks ────────────────────────────────────────────
describe("listPostedBooks", () => {
  it("filtra por book_type y mapea sin líneas (vista de listado)", async () => {
    const { client, calls } = stub({
      fiscal_books: [
        {
          id: "book-1",
          period: "2026-06",
          book_type: "ventas",
          status: "anulado",
          total_base: "100",
          total_iva: "0",
          total_total: "100",
          total_base_exenta: "100",
          total_base_gravada: "0",
          total_base_tasa_cero: "0",
          row_count: "1",
          currencies: ["USD"],
          default_iva_mode: "sin_iva",
          posted_at: "2026-07-01T10:00:00Z",
          posted_by: "u1",
          voided_at: "2026-07-02T10:00:00Z",
          voided_by: "u1",
          void_reason: "corrección",
        },
      ],
    });
    const list = await listPostedBooks(client, "ventas");
    expect(calls.fiscal_books.eq).toContainEqual(["book_type", "ventas"]);
    expect(list).toHaveLength(1);
    expect(list[0].status).toBe("anulado");
    expect(list[0].entries).toEqual([]);
    expect(list[0].voidReason).toBe("corrección");
  });
});

/**
 * El bug del tope de 1.000 filas, sobre el documento que se PRESENTA.
 *
 * El doble de prueba corta en 1.000 filas por request igual que PostgREST, así
 * que este test falla con `.limit(20000)` y pasa con paginación real. Es la
 * demostración de que el número cambia: sin ella, el arreglo sería una
 * afirmación sin medir.
 */
describe("getPostedBook · el libro no se trunca en 1.000 líneas", () => {
  const libro = {
    id: "b1",
    period: "2026-06",
    book_type: "ventas",
    status: "asentado",
    total_base: "0",
    total_iva: "0",
    total_total: "0",
    total_base_exenta: "0",
    total_base_gravada: "0",
    total_base_tasa_cero: "0",
    row_count: "1500",
    currencies: ["USD"],
    default_iva_mode: null,
    posted_at: "2026-07-01T00:00:00Z",
    posted_by: null,
    voided_at: null,
    voided_by: null,
    void_reason: null,
  };

  it("trae las 1.500 líneas, no las primeras 1.000", async () => {
    const lineas = Array.from({ length: 1500 }, (_, i) => ({
      id: `l${i + 1}`,
      line_no: i + 1,
      op_date: "2026-06-15",
      document_number: `F-${i + 1}`,
      control_number: null,
      rif: "J-123",
      party_name: "Cliente",
      iva_class: "gravada",
      base: "100",
      rate: "16",
      iva: "16",
      total: "116",
      retention: null,
      currency: "USD",
      source_type: "invoice",
      source_ref: null,
    }));

    const { client } = stub({
      fiscal_books: [libro],
      fiscal_book_entries: lineas,
    });

    const res = await getPostedBook(client, "2026-06", "ventas");
    expect(res).not.toBeNull();
    expect(res!.entries).toHaveLength(1500);
    // Y la última línea es la 1500: no se cortó ni se repitió una página.
    expect(res!.entries[1499].lineNo).toBe(1500);
  });
});
