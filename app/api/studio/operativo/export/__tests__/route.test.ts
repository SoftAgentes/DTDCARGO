// @vitest-environment node

/**
 * SDD-0289: descarga HTTP -> consultas/paginador/builders reales.
 * Sólo sesión/acceso y transporte de tablas son dobles; sin red, RLS o PII real.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { MAX_PAGES } from "@/lib/db/paginate";

const boundaries = vi.hoisted(() => ({ session: vi.fn(), access: vi.fn() }));
vi.mock("@/lib/http/studio-session", () => ({ requireStudioSession: boundaries.session }));
vi.mock("@/lib/studio/rbac-guard", () => ({ getStudioAccess: boundaries.access }));

import { GET } from "../route";

type Row = Record<string, string | number | null>;
type Table = "clients" | "shipments" | "invoices" | "collection_activities";

/** Respeta filtros/orden/rango y aplica un tope de 400, menor al pedido. */
function fixtureDb() {
  const tables: Record<Table, Row[]> = { clients: [], shipments: [], invoices: [], collection_activities: [] };
  const endless = new Set<Table>();
  const errorAt = new Map<Table, number>();
  const calls: Array<{ table: Table; from: number; to: number }> = [];
  const from = vi.fn((table: Table) => {
    if (!(table in tables)) throw new Error(`Tabla no prevista en fixture: ${table}`);
    const filters: Array<(row: Row) => boolean> = [];
    const orders: Array<{ column: string; ascending: boolean }> = [];
    const query = {
      select: () => query,
      is(column: string, value: null) { filters.push((row) => row[column] === value); return query; },
      neq(column: string, value: string) { filters.push((row) => row[column] !== value); return query; },
      in(column: string, values: string[]) { filters.push((row) => values.includes(String(row[column]))); return query; },
      order(column: string, options: { ascending: boolean }) { orders.push({ column, ascending: options.ascending }); return query; },
      async range(start: number, end: number) {
        calls.push({ table, from: start, to: end });
        if (start >= (errorAt.get(table) ?? Infinity)) {
          return { data: null, error: { message: "internal_fixture_failure" } };
        }
        const rows = tables[table].filter((row) => filters.every((filter) => filter(row)));
        rows.sort((a, b) => {
          for (const order of orders) {
            const left = String(a[order.column] ?? "");
            const right = String(b[order.column] ?? "");
            const delta = left < right ? -1 : left > right ? 1 : 0;
            if (delta) return order.ascending ? delta : -delta;
          }
          return 0;
        });
        return { data: endless.has(table) ? rows.slice(0, 1) : rows.slice(start, start + Math.min(end - start + 1, 400)), error: null };
      },
    };
    return query;
  });
  return { tables, endless, errorAt, calls, from };
}

let db: ReturnType<typeof fixtureDb>;

function rows(table: Table, total: number): Row[] {
  return Array.from({ length: total }, (_, index) => {
    const id = `TEST-${String(index + 1).padStart(5, "0")}`;
    const common = { id, created_at: "2026-08-01T00:00:00Z", deleted_at: null };
    if (table === "clients") return { ...common, markbox: id, name: "Cliente sintético", tier: "regular", registration_channel: "admin" };
    if (table === "shipments") return { ...common, code: id, shipment_service: "consolidado_lcl", status: "in_transit" };
    if (table === "invoices") return {
      ...common, invoice_code: id, client_name: "Cliente sintético", client_markbox: id,
      currency: "USD", total_amount: 25, paid_amount: 0, status: "emitida",
      due_date: "2026-08-01", issued_at: "2026-07-01",
    };
    return { ...common, invoice_id: "TEST-00001", kind: "nota" };
  });
}

function request(tipo: string, extra = "") {
  return new Request(`https://export-fixture.invalid/api/studio/operativo/export?tipo=${tipo}${extra}`);
}

const exports = [
  { tipo: "clientes", table: "clients", filename: "clientes" },
  { tipo: "embarques", table: "shipments", filename: "embarques" },
  { tipo: "cobranzas", table: "invoices", filename: "cobranzas" },
] as const;

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-02T12:00:00Z"));
  vi.stubEnv("NODE_ENV", "production");
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Red no permitida en este fixture"); }));
  vi.spyOn(console, "error").mockImplementation(() => {});
  db = fixtureDb();
  boundaries.session.mockResolvedValue({ supabase: db });
  boundaries.access.mockResolvedValue({ role: "admin", overrides: [] });
});

afterEach(() => {
  expect(fetch).not.toHaveBeenCalled();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe.each(exports)("SDD-0289: HTTP $tipo", ({ tipo, table, filename }) => {
  it("descarga 2.501 filas aunque cada página sólo entregue 400", async () => {
    db.tables[table] = rows(table, 2501);
    const response = await GET(request(tipo, "&q=sin-coincidencias&tab=otro"));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(response.headers.get("content-disposition")).toBe(`attachment; filename="${filename}-2026-09-02.csv"`);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    const bytes = new Uint8Array(await response.arrayBuffer());
    expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
    const csv = new TextDecoder("utf-8", { ignoreBOM: true }).decode(bytes);
    const lines = csv.slice(1).split("\r\n");
    expect(lines).toHaveLength(2502);
    expect(new Set(lines.slice(1).map((line) => line.split(",")[0])).size).toBe(2501);
    expect(csv).toContain("TEST-02501");
    expect(db.calls.filter((call) => call.table === table).map((call) => call.from)).toEqual([0, 400, 800, 1200, 1600, 2000, 2400, 2501]);
  });

  it("responde error y no adjunto si falla después de una página válida", async () => {
    db.tables[table] = rows(table, 900);
    db.errorAt.set(table, 400);
    const response = await GET(request(tipo));
    expect(response.status).toBe(500);
    expect(response.headers.get("content-disposition")).toBeNull();
    expect(await response.json()).toEqual({ error: "No se pudo generar el CSV." });
  });

  it("no publica un CSV parcial cuando se agotan las páginas", async () => {
    db.tables[table] = rows(table, 1);
    db.endless.add(table);
    const response = await GET(request(tipo));
    expect(response.status).toBe(500);
    expect(response.headers.get("content-disposition")).toBeNull();
    expect(await response.json()).toEqual({ error: "No se pudo generar el CSV." });
    expect(db.calls.filter((call) => call.table === table)).toHaveLength(MAX_PAGES);
  });

  it("no consulta tablas cuando el rol no tiene vista del módulo", async () => {
    boundaries.access.mockResolvedValue({ role: "marketing", overrides: [] });
    const response = await GET(request(tipo));
    expect(response.status).toBe(403);
    expect(response.headers.get("content-disposition")).toBeNull();
    expect(db.from).not.toHaveBeenCalled();
  });
});

describe("SDD-0289: fronteras del endpoint", () => {
  it.each([401, 403])("propaga el rechazo de sesión %s antes de resolver acceso", async (status) => {
    const denied = NextResponse.json({ error: "Sin acceso" }, { status });
    boundaries.session.mockResolvedValue(denied);
    expect(await GET(request("clientes"))).toBe(denied);
    expect(boundaries.access).not.toHaveBeenCalled();
    expect(db.from).not.toHaveBeenCalled();
  });

  it("rechaza tipos desconocidos sin consultar tablas", async () => {
    const response = await GET(request("otro"));
    expect(response.status).toBe(400);
    expect(db.from).not.toHaveBeenCalled();
  });

  it.each(["clients", "shipments"] as const)("no exporta borrados de %s", async (table) => {
    db.tables[table] = rows(table, 2);
    db.tables[table][1].deleted_at = "2026-09-01T00:00:00Z";
    const response = await GET(request(table === "clients" ? "clientes" : "embarques"));
    const csv = await response.text();
    expect(response.status).toBe(200);
    expect(csv).toContain("TEST-00001");
    expect(csv).not.toContain("TEST-00002");
  });

  it("Cobranzas tampoco descarga si las gestiones quedan incompletas", async () => {
    db.tables.invoices = rows("invoices", 1);
    db.tables.collection_activities = rows("collection_activities", 1);
    db.endless.add("collection_activities");
    const response = await GET(request("cobranzas"));
    expect(response.status).toBe(500);
    expect(response.headers.get("content-disposition")).toBeNull();
    expect(await response.json()).toEqual({ error: "No se pudo generar el CSV." });
  });

  it("Cobranzas excluye anuladas y facturas sin saldo", async () => {
    db.tables.invoices = rows("invoices", 3);
    db.tables.invoices[1].status = "anulada";
    db.tables.invoices[2].paid_amount = 25;
    const response = await GET(request("cobranzas"));
    const csv = await response.text();
    expect(response.status).toBe(200);
    expect(csv).toContain("TEST-00001");
    expect(csv).not.toContain("TEST-00002");
    expect(csv).not.toContain("TEST-00003");
  });
});
