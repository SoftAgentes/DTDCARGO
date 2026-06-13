/**
 * Tests de queries del módulo Fiscal/SENIAT (SDD-0073).
 *
 * Cubre Acceptance §5 + los findings de la ronda 2 de review:
 *  - getFiscalSettings cae a DEFAULT_FISCAL_SETTINGS cuando no hay row…
 *  - …pero PROPAGA un error de lectura real (no fabrica un libro exento, #3).
 *  - getFiscalSettings mapea la row (numeric string → number) cuando existe.
 *  - salesBook NO selecciona invoices.rif (columna inexistente, #1): el set
 *    seleccionado debe estar contenido en las columnas reales de invoices (0077).
 *  - salesBook resuelve RIF+nombre desde `clients` por client_markbox (sin N+1),
 *    y deja "—" cuando no hay match.
 *  - salesBook EXCLUYE borrador del Libro de Ventas (#2): filtra .in(status,
 *    [emitida,parcial,pagada,vencida]).
 *  - salesBook/purchaseBook reportan las monedas presentes (#5).
 *  - purchaseBook filtra issue_date del mes, excluye anuladas y deja IVA en "—"
 *    honesto (V1 sin discriminar) extrayendo el RIF embebido del proveedor.
 *
 * Stub chainable que enruta por tabla y registra los filtros (in/neq/is/gte/lte)
 * + la lista de columnas del select. Cada builder es thenable (await directo) y
 * expone `.maybeSingle()`. Soporta inyectar un error por tabla (para #3).
 */

import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getFiscalSettings,
  purchaseBook,
  salesBook,
  INVOICE_COLUMNS,
  SALE_STATUSES,
} from "../queries";
import { DEFAULT_FISCAL_SETTINGS, type FiscalSettings } from "../config-types";

// Columnas que realmente existen en invoices (0077_invoices.sql) — la verdad
// contra la que se valida lo que selecciona salesBook. Si alguien vuelve a
// seleccionar `rif` (que NO está acá), el test de abajo falla. Falso-verde out.
const REAL_INVOICE_COLUMNS = new Set([
  "id",
  "tenant_id",
  "invoice_code",
  "client_markbox",
  "client_name",
  "shipment_id",
  "shipment_code",
  "currency",
  "fx_rate",
  "iva_rate",
  "base_amount",
  "iva_amount",
  "total_amount",
  "status",
  "issued_at",
  "due_date",
  "paid_amount",
  "last_payment_at",
  "lines",
  "notes",
  "created_at",
  "updated_at",
  "deleted_at",
]);

type Recorded = {
  in: [string, unknown][];
  neq: [string, unknown][];
  is: [string, unknown][];
  gte: [string, unknown][];
  lte: [string, unknown][];
  selects: string[];
};

function stub(
  rowsByTable: Record<string, Record<string, unknown>[] | null>,
  errorByTable: Record<string, { code?: string; message?: string }> = {},
): {
  client: SupabaseClient;
  calls: Record<string, Recorded>;
} {
  const calls: Record<string, Recorded> = {};

  const client = {
    from(table: string) {
      const rows = rowsByTable[table] ?? [];
      const err = errorByTable[table] ?? null;
      calls[table] = calls[table] ?? {
        in: [],
        neq: [],
        is: [],
        gte: [],
        lte: [],
        selects: [],
      };
      const rec = calls[table];
      const listResult = { data: err ? null : rows, error: err };
      // maybeSingle → primera row o null (lo que devuelve el singleton).
      const single = {
        data: err ? null : Array.isArray(rows) ? (rows[0] ?? null) : null,
        error: err,
      };

      const chain: Record<string, unknown> = {
        select: (cols?: string) => {
          if (typeof cols === "string") rec.selects.push(cols);
          return chain;
        },
        order: () => chain,
        limit: () => chain,
        in: (c: string, v: unknown) => (rec.in.push([c, v]), chain),
        neq: (c: string, v: unknown) => (rec.neq.push([c, v]), chain),
        is: (c: string, v: unknown) => (rec.is.push([c, v]), chain),
        gte: (c: string, v: unknown) => (rec.gte.push([c, v]), chain),
        lte: (c: string, v: unknown) => (rec.lte.push([c, v]), chain),
        maybeSingle: () => Promise.resolve(single),
        then: (resolve: (v: typeof listResult) => unknown) =>
          Promise.resolve(listResult).then(resolve),
      };
      return chain;
    },
  } as unknown as SupabaseClient;

  return { client, calls };
}

/** Parsea un select PostgREST a la lista de columnas top-level (ignora embeds). */
function topLevelColumns(select: string): string[] {
  return select
    .replace(/\w+\([^)]*\)/g, "") // quita embeds tipo suppliers(tax_id)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

const SETTINGS_EXENTO: FiscalSettings = {
  ...DEFAULT_FISCAL_SETTINGS,
  service_iva_treatment: "exento",
  tenant_id: "t1",
  updated_at: null,
  updated_by: null,
};
const SETTINGS_GRAVADO: FiscalSettings = {
  ...SETTINGS_EXENTO,
  service_iva_treatment: "gravado",
};

// ── getFiscalSettings ──────────────────────────────────────────
describe("getFiscalSettings", () => {
  it("cae a los defaults cuando no hay row (cero-config)", async () => {
    const { client } = stub({ fiscal_settings: [] });
    const s = await getFiscalSettings(client);
    expect(s.service_iva_treatment).toBe(DEFAULT_FISCAL_SETTINGS.service_iva_treatment);
    expect(s.iva_rate).toBe(DEFAULT_FISCAL_SETTINGS.iva_rate);
    expect(s.is_iva_withholding_agent).toBe(true);
    expect(s.tenant_id).toBeNull(); // aún no persistida
  });

  it("PROPAGA un error de lectura real (no fabrica un libro exento, #3)", async () => {
    const { client } = stub(
      { fiscal_settings: [] },
      { fiscal_settings: { code: "57014", message: "statement timeout" } },
    );
    await expect(getFiscalSettings(client)).rejects.toMatchObject({
      code: "57014",
    });
  });

  it("trata PGRST116 ('no rows') como cero-config, no como error", async () => {
    const { client } = stub(
      { fiscal_settings: [] },
      { fiscal_settings: { code: "PGRST116", message: "no rows" } },
    );
    const s = await getFiscalSettings(client);
    expect(s.service_iva_treatment).toBe(DEFAULT_FISCAL_SETTINGS.service_iva_treatment);
    expect(s.tenant_id).toBeNull();
  });

  it("mapea la row y normaliza numeric (string → number)", async () => {
    const { client } = stub({
      fiscal_settings: [
        {
          tenant_id: "t1",
          service_iva_treatment: "gravado",
          iva_rate: "16.00",
          is_special_taxpayer: true,
          is_iva_withholding_agent: false,
          iva_withholding_pct: "100.00",
          purchase_iva_mode: "derivado",
          declaration_period: "mensual",
          updated_at: "2026-06-12T00:00:00Z",
          updated_by: "u1",
        },
      ],
    });
    const s = await getFiscalSettings(client);
    expect(s.tenant_id).toBe("t1");
    expect(s.service_iva_treatment).toBe("gravado");
    expect(s.iva_rate).toBe(16);
    expect(typeof s.iva_rate).toBe("number");
    expect(s.iva_withholding_pct).toBe(100);
    expect(s.is_special_taxpayer).toBe(true);
    expect(s.is_iva_withholding_agent).toBe(false);
  });
});

// ── INVOICE_COLUMNS contra el schema real (#1, anti falso-verde) ──
describe("INVOICE_COLUMNS solo selecciona columnas reales de invoices", () => {
  it("cada columna seleccionada existe en invoices (0077) — y NO incluye rif", () => {
    const cols = topLevelColumns(INVOICE_COLUMNS);
    for (const c of cols) {
      expect(REAL_INVOICE_COLUMNS.has(c)).toBe(true);
    }
    // El bug bloqueante de la ronda 1 era seleccionar invoices.rif (no existe).
    expect(cols).not.toContain("rif");
    // Sí necesita el lookup textual del cliente para resolver el RIF aparte.
    expect(cols).toContain("client_markbox");
  });
});

// ── salesBook ──────────────────────────────────────────────────
describe("salesBook", () => {
  it("filtra el rango mensual sobre created_at y EXCLUYE borrador (#2)", async () => {
    const { client, calls } = stub({ invoices: [], clients: [] });
    await salesBook(client, "2026-06", SETTINGS_EXENTO);

    expect(calls.invoices.gte).toContainEqual(["created_at", "2026-06-01"]);
    expect(calls.invoices.lte[0][0]).toBe("created_at");
    expect(String(calls.invoices.lte[0][1])).toContain("2026-06-30");
    // soft-delete fuera.
    expect(calls.invoices.is).toContainEqual(["deleted_at", null]);
    // Solo estados EMITIDOS — borrador y anulada quedan fuera del libro fiscal.
    expect(calls.invoices.in).toHaveLength(1);
    const [col, statuses] = calls.invoices.in[0];
    expect(col).toBe("status");
    expect(statuses).toEqual([...SALE_STATUSES]);
    expect(statuses).not.toContain("borrador");
    expect(statuses).not.toContain("anulada");
    // Y ya NO se usa el viejo .neq("status","anulada") (que dejaba pasar borradores).
    expect(calls.invoices.neq).toHaveLength(0);
  });

  it("resuelve RIF+nombre desde clients por client_markbox (sin N+1)", async () => {
    const { client, calls } = stub({
      invoices: [
        {
          invoice_code: "F-2026-0001",
          client_markbox: "DTD-1001",
          client_name: "Cliente A (snapshot)",
          currency: "USD",
          base_amount: "1000",
          iva_amount: "160",
          iva_rate: "16",
          total_amount: "1160",
          issued_at: "2026-06-10",
          created_at: "2026-06-10T12:00:00Z",
          status: "emitida",
        },
      ],
      clients: [{ markbox: "DTD-1001", name: "Cliente A", rif: "J-12345678-9" }],
    });
    const { rows } = await salesBook(client, "2026-06", SETTINGS_GRAVADO);
    expect(rows).toHaveLength(1);
    expect(rows[0].invoiceCode).toBe("F-2026-0001");
    // RIF viene de clients (invoices no lo tiene).
    expect(rows[0].rif).toBe("J-12345678-9");
    // Nombre: snapshot de la factura tiene prioridad.
    expect(rows[0].clientName).toBe("Cliente A (snapshot)");
    expect(rows[0].ivaClass).toBe("gravada");
    expect(rows[0].base).toBe(1000);
    expect(rows[0].iva).toBe(160);
    expect(rows[0].rate).toBe(16);
    // 1 sola query a clients (sin N+1), con el markbox del período.
    expect(calls.clients.in).toContainEqual(["markbox", ["DTD-1001"]]);
  });

  it("factura sin cliente que matchee → RIF '—' (null), sin fabricar", async () => {
    const { client } = stub({
      invoices: [
        {
          invoice_code: "F-2026-0099",
          client_markbox: "DTD-9999", // no existe en clients
          client_name: "Huérfana",
          currency: "USD",
          base_amount: "100",
          iva_amount: "0",
          iva_rate: "0",
          total_amount: "100",
          issued_at: "2026-06-10",
          created_at: "2026-06-10T12:00:00Z",
          status: "emitida",
        },
      ],
      clients: [],
    });
    const { rows } = await salesBook(client, "2026-06", SETTINGS_EXENTO);
    expect(rows[0].rif).toBeNull(); // UI muestra "—"
  });

  it("reporta las monedas presentes (#5)", async () => {
    const { client } = stub({
      invoices: [
        {
          invoice_code: "F-1",
          client_markbox: "DTD-1001",
          client_name: "A",
          currency: "USD",
          base_amount: "100",
          iva_amount: "0",
          iva_rate: "0",
          total_amount: "100",
          issued_at: "2026-06-01",
          created_at: "2026-06-01T00:00:00Z",
          status: "emitida",
        },
        {
          invoice_code: "F-2",
          client_markbox: "DTD-1002",
          client_name: "B",
          currency: "VES",
          base_amount: "200",
          iva_amount: "0",
          iva_rate: "0",
          total_amount: "200",
          issued_at: "2026-06-02",
          created_at: "2026-06-02T00:00:00Z",
          status: "pagada",
        },
      ],
      clients: [],
    });
    const { currencies } = await salesBook(client, "2026-06", SETTINGS_EXENTO);
    expect(currencies).toEqual(["USD", "VES"]);
  });

  it("con la misma factura pero config exenta → IVA 0 (Acceptance: cambia sin tocar código)", async () => {
    const { client } = stub({
      invoices: [
        {
          invoice_code: "F-2026-0001",
          client_markbox: "DTD-1001",
          client_name: "Cliente A",
          currency: "USD",
          base_amount: "1000",
          iva_amount: "160",
          iva_rate: "16",
          total_amount: "1160",
          issued_at: "2026-06-10",
          created_at: "2026-06-10T12:00:00Z",
          status: "emitida",
        },
      ],
      clients: [{ markbox: "DTD-1001", name: "Cliente A", rif: "J-1" }],
    });
    const { rows } = await salesBook(client, "2026-06", SETTINGS_EXENTO);
    expect(rows[0].ivaClass).toBe("exenta");
    expect(rows[0].iva).toBe(0);
    expect(rows[0].rate).toBeNull();
  });
});

// ── purchaseBook ───────────────────────────────────────────────
describe("purchaseBook", () => {
  it("filtra issue_date del mes y excluye anuladas", async () => {
    const { client, calls } = stub({ supplier_bills: [] });
    await purchaseBook(client, "2026-02", SETTINGS_GRAVADO);

    expect(calls.supplier_bills.gte).toContainEqual(["issue_date", "2026-02-01"]);
    // 2026 no es bisiesto → feb termina el 28.
    expect(calls.supplier_bills.lte).toContainEqual(["issue_date", "2026-02-28"]);
    expect(calls.supplier_bills.is).toContainEqual(["deleted_at", null]);
    expect(calls.supplier_bills.neq).toContainEqual(["status", "anulada"]);
  });

  it("mapea total real, extrae RIF embebido y deja IVA/base en '—' (null) honesto", async () => {
    const { client } = stub({
      supplier_bills: [
        {
          bill_code: "CXP-2026-0001",
          supplier_name: "Proveedor X",
          reference: "FAC-998",
          currency: "USD",
          total_amount: "500",
          issue_date: "2026-02-10",
          created_at: "2026-02-10T00:00:00Z",
          status: "pendiente",
          suppliers: { tax_id: "J-PRV-1" },
        },
      ],
    });
    const { rows } = await purchaseBook(client, "2026-02", SETTINGS_GRAVADO);
    expect(rows).toHaveLength(1);
    expect(rows[0].documentNumber).toBe("FAC-998"); // usa reference del proveedor
    expect(rows[0].supplierName).toBe("Proveedor X");
    expect(rows[0].rif).toBe("J-PRV-1");
    expect(rows[0].total).toBe(500);
    // V1: supplier_bills no discrimina IVA → no se fabrica (§3.2).
    expect(rows[0].base).toBeNull();
    expect(rows[0].iva).toBeNull();
    expect(rows[0].rate).toBeNull();
  });

  it("acepta el embed del proveedor como array (forma alterna de PostgREST)", async () => {
    const { client } = stub({
      supplier_bills: [
        {
          bill_code: "CXP-2026-0002",
          supplier_name: "Proveedor Y",
          reference: null,
          currency: "USD",
          total_amount: "200",
          issue_date: "2026-02-15",
          created_at: "2026-02-15T00:00:00Z",
          status: "pendiente",
          suppliers: [{ tax_id: "J-PRV-2" }],
        },
      ],
    });
    const { rows } = await purchaseBook(client, "2026-02", SETTINGS_GRAVADO);
    expect(rows[0].rif).toBe("J-PRV-2");
    // sin reference → cae al código interno del bill.
    expect(rows[0].documentNumber).toBe("CXP-2026-0002");
  });

  it("reporta las monedas presentes (#5)", async () => {
    const { client } = stub({
      supplier_bills: [
        {
          bill_code: "CXP-1",
          supplier_name: "X",
          reference: null,
          currency: "USD",
          total_amount: "100",
          issue_date: "2026-02-01",
          created_at: "2026-02-01T00:00:00Z",
          status: "pendiente",
          suppliers: { tax_id: "J-1" },
        },
        {
          bill_code: "CXP-2",
          supplier_name: "Y",
          reference: null,
          currency: "CNY",
          total_amount: "300",
          issue_date: "2026-02-05",
          created_at: "2026-02-05T00:00:00Z",
          status: "pendiente",
          suppliers: { tax_id: "J-2" },
        },
      ],
    });
    const { currencies } = await purchaseBook(client, "2026-02", SETTINGS_GRAVADO);
    expect(currencies).toEqual(["CNY", "USD"]);
  });
});
