/**
 * SDD-0574 F1–F3: lector -> regla -> RSC y primitivas reales.
 * El único doble de datos está en createClient. Filtra/pagina arrays sintéticos;
 * NO prueba PostgreSQL, PostgREST ni RLS. Tampoco prueba CSS por usar jsdom.
 */
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import Page from "./page";
import ReportesLayout from "../layout";

const mocks = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@/lib/db/server", () => ({ createClient: mocks.createClient }));
vi.mock("next/navigation", () => ({
  redirect: (href: string) => { throw new Error(`REDIRECT ${href}`); },
}));

type Row = Record<string, unknown>;
type Fixture = {
  tables: Record<string, Row[]>;
  maxRows?: Partial<Record<string, number>>;
  errors?: Record<string, { code: string; message: string }>;
  user?: string | null;
  reads: string[];
};

function receipt(id: string, markbox = "DTD-0001", cbm: number | null = 2): Row {
  return { id, receipt_code: `WR-${id}`, client_markbox: markbox, total_cbm: cbm, shipment_id: "s1", received_at: "2026-10-01", status: "consolidado", deleted_at: null, is_orphan: false };
}
function snapshot(id: string, amount = "1700.00", cbm = "2", perCbm = "850.00", minimum = "0"): Row {
  return { id: `t-${id}`, receipt_id: id, cbm, per_cbm: perCbm, min_charge: minimum, amount_to_invoice: amount, superseded_at: null, included_kg_per_cbm: 500 };
}
function fixture(): Fixture {
  return {
    reads: [], user: "synthetic-user",
    tables: {
      user_tenants: [{ user_id: "synthetic-user", tenant_id: "synthetic-tenant", role: "accounting", disabled_at: null }],
      studio_role_module_overrides: [],
      warehouse_receipts_cn: [receipt("conocida")],
      shipments: [{ id: "s1", code: "C-sintetico", status: "arrived_destination", arrived_destination_at: "2026-10-10" }],
      invoices: [],
      shipment_rate_snapshots: [snapshot("conocida")],
    },
  };
}
function database(f: Fixture): SupabaseClient {
  return {
    auth: { getUser: async () => ({ data: { user: f.user ? { id: f.user } : null }, error: null }) },
    from: (table: string) => {
      const filters: ((row: Row) => boolean)[] = [];
      let from = 0;
      let to = Infinity;
      const chain: Record<string, unknown> = {};
      const rows = () => (f.tables[table] ?? []).filter((row) => filters.every((fn) => fn(row))).slice(from, to + 1).slice(0, f.maxRows?.[table] ?? Infinity).map((row) => ({ ...row }));
      chain.select = () => chain;
      chain.returns = () => chain;
      chain.eq = (key: string, value: unknown) => (filters.push((row) => row[key] === value), chain);
      chain.is = (key: string, value: unknown) => (filters.push((row) => (row[key] ?? null) === value), chain);
      chain.in = (key: string, values: unknown[]) => (filters.push((row) => values.includes(row[key])), chain);
      chain.order = () => chain;
      chain.range = (first: number, last: number) => ((from = first), (to = last), chain);
      chain.limit = (limit: number) => ((to = limit - 1), chain);
      const result = () => {
        f.reads.push(table);
        return f.errors?.[table] ? { data: null, error: f.errors[table] } : { data: rows(), error: null };
      };
      chain.maybeSingle = async () => { const r = result(); return { ...r, data: r.data?.[0] ?? null }; };
      chain.then = (resolve: (value: unknown) => unknown) => resolve(result());
      return chain;
    },
  } as unknown as SupabaseClient;
}
async function renderPage(f: Fixture) {
  mocks.createClient.mockResolvedValue(database(f));
  render(await Page());
}
function kpi(label: string) {
  // La etiqueta real de KpiCard es un div; los badges de la tabla son spans.
  return within(screen.getByText(label, { selector: "div" }).parentElement!);
}
function incompleteCovered(): Fixture {
  const f = fixture();
  f.tables.warehouse_receipts_cn = Array.from({ length: 61 }, (_, i) => receipt(`r${i}`));
  f.tables.invoices = [{ id: "f1", invoice_code: "F-sintetica", shipment_id: "s1", client_markbox: "DTD-0001", status: "emitida", deleted_at: null }];
  f.maxRows = { warehouse_receipts_cn: 1 }; // 60 páginas no vacías, no se toca el paginador.
  return f;
}

beforeEach(() => mocks.createClient.mockReset());
afterEach(() => cleanup());

describe("Reporte real de embarques sin facturar · F1–F3", () => {
  it("F1: llegada sin snapshot muestra importe no disponible y contador, nunca cero conocido", async () => {
    const f = fixture();
    f.tables.shipment_rate_snapshots = [];
    await renderPage(f);
    expect(kpi("Llegó sin factura").getByText(/Importe no disponible/)).toBeInTheDocument();
    expect(kpi("Llegó sin factura").getByText(/1 sin tarifa disponible/)).toBeInTheDocument();
    expect(kpi("Llegó sin factura").queryByText(/\$0\.00/)).toBeNull();
    expect(screen.getByRole("row", { name: /WR-conocida/ })).toHaveTextContent("Sin tarifa");
  });

  it("F1: 1700 + desconocido se presenta como subtotal con el faltante también global", async () => {
    const f = fixture();
    f.tables.warehouse_receipts_cn.push(receipt("faltante", "DTD-0002"));
    await renderPage(f);
    expect(kpi("Llegó sin factura").getByText(/Subtotal conocido: \$1,700\.00/)).toBeInTheDocument();
    expect(kpi("Llegó sin factura").getByText(/1 sin tarifa disponible/)).toBeInTheDocument();
    expect(kpi("Llegó sin factura").queryByText(/^\$1,700\.00 a facturar$/)).toBeNull();
    expect(screen.getByRole("status", { name: "Resumen global por facturar" })).toHaveTextContent(/2 recepciones.*1 sin tarifa disponible/);
  });

  it("F1: cero conocido sigue siendo $0.00 a facturar, no importe ausente", async () => {
    const f = fixture();
    f.tables.shipment_rate_snapshots = [snapshot("conocida", "0.00", "0.001", "1.00")];
    await renderPage(f);
    expect(kpi("Llegó sin factura").getByText("$0.00 a facturar")).toBeInTheDocument();
    expect(kpi("Llegó sin factura").queryByText(/Importe no disponible/)).toBeNull();
  });

  it.each([
    { ultimo: "1992547499.91", visible: "$90,071,992,547,409.91" },
    { ultimo: "1992547499.92", visible: "$90,071,992,547,409.92" },
    { ultimo: "1992547499.93", visible: "$90,071,992,547,409.93" },
  ])("F1 precisión: la página real imprime $visible sin perder un centavo del agregado", async ({ ultimo, visible }) => {
    const f = fixture();
    const rates = [
      ...Array.from({ length: 90 }, (_, i) => snapshot(`grande-${i}`, "999999999999.00", "100.000", "9999999999.99")),
      snapshot("complemento", "70000000000.00", "100.000", "700000000.00"),
      snapshot("ultimo", ultimo, "1.000", ultimo),
    ];
    f.tables.warehouse_receipts_cn = rates.map((rate) => receipt(String(rate.receipt_id)));
    f.tables.shipment_rate_snapshots = rates;
    await renderPage(f);
    expect(kpi("Llegó sin factura").getByText(`${visible} a facturar`)).toBeInTheDocument();
    const global = screen.getByRole("status", { name: "Resumen global por facturar" });
    expect(global).toHaveTextContent(`${visible} a facturar`);
    expect(global).toHaveTextContent(/92 recepciones/);
    expect(global).not.toHaveTextContent(/importe no disponible|lectura parcial/i);
  });

  it("F1: sin 0496 conserva la llegada, explica la indisponibilidad y no afirma otro grupo", async () => {
    const f = fixture();
    f.errors = { shipment_rate_snapshots: { code: "42P01", message: "tabla sintética ausente" } };
    await renderPage(f);
    expect(kpi("Llegó sin factura").getByText("1")).toBeInTheDocument();
    expect(kpi("Llegó sin factura").getByText(/Importe no disponible/)).toBeInTheDocument();
    expect(screen.getAllByRole("status").some((e) => /tarifa congelada.*no está disponible/i.test(e.textContent ?? ""))).toBe(true);
    expect(screen.queryByText(/todas las recepciones aparecen sin tarifa/i)).toBeNull();
  });

  it.each([
    { actual: 3, aviso: "CBM actual cambió" },
    { actual: null, aviso: "CBM actual no disponible" },
    { actual: 2, aviso: null },
    { actual: 2.0004, aviso: null },
    { actual: 2.001, aviso: "CBM actual cambió" },
  ])("F2: importe congelado y bases explícitas con CBM actual $actual", async ({ actual, aviso }) => {
    const f = fixture();
    f.tables.warehouse_receipts_cn[0].total_cbm = actual;
    await renderPage(f);
    const row = screen.getByRole("row", { name: /WR-conocida/ });
    const headings = screen.getAllByRole("columnheader").map((e) => e.textContent);
    expect(headings).toContain("CBM congelado (m³)");
    expect(headings).toContain("CBM actual (m³)");
    const cells = within(row).getAllByRole("cell");
    expect(cells[headings.indexOf("CBM congelado (m³)")]).toHaveTextContent(/^2$/);
    expect(cells[headings.indexOf("CBM actual (m³)")]).toHaveTextContent(actual == null ? "—" : actual.toLocaleString("es-VE", { maximumFractionDigits: 3 }));
    expect(row).toHaveTextContent("$1,700.00");
    expect(row).toHaveTextContent("$850.00/m³");
    expect(row).not.toHaveTextContent("$2,550.00");
    if (aviso) expect(within(row).getByText(aviso)).toBeInTheDocument();
    else expect(within(row).queryByText(/CBM actual (cambió|no disponible)/)).toBeNull();
  });

  it("F2: mínimo y reemplazo usan solo el snapshot vivo y el importe fuente", async () => {
    const f = fixture();
    f.tables.shipment_rate_snapshots = [
      snapshot("conocida", "100.00", "0.1", "850.00", "100.00"),
      { ...snapshot("conocida", "9999.00", "99", "101.00", "9999.00"), superseded_at: "2026-10-01" },
    ];
    await renderPage(f);
    const row = screen.getByRole("row", { name: /WR-conocida/ });
    expect(row).toHaveTextContent("$100.00");
    expect(row).toHaveTextContent("Mínimo $100.00");
    expect(row).not.toHaveTextContent("$9,999.00");
    expect(row).not.toHaveTextContent("$85.00");
  });

  it("F3: vacío completo elegible admite Al día con alcance veraz", async () => {
    const f = fixture();
    f.tables.warehouse_receipts_cn = [];
    await renderPage(f);
    expect(screen.getByText("Al día")).toBeInTheDocument();
    expect(screen.getByText(/No hay recepciones elegibles sin factura fiscal/)).toBeInTheDocument();
    expect(screen.queryByText("Toda recepción con cliente tiene su factura fiscal.")).toBeNull();
  });

  it("F3: vacío parcial no certifica Al día ni ausencia universal", async () => {
    await renderPage(incompleteCovered());
    expect(screen.queryByText("Al día")).toBeNull();
    expect(screen.queryByText("No hay embarques sin facturar")).toBeNull();
    expect(screen.queryByText("Toda recepción con cliente tiene su factura fiscal.")).toBeNull();
    expect(screen.getByText(/No se encontraron pendientes en la parte leída/)).toBeInTheDocument();
    expect(screen.getAllByRole("status").some((e) => /lectura.*(parcial|cortó)/i.test(e.textContent ?? ""))).toBe(true);
  });

  it("F3: parcial con filas conserva el subconjunto y no llama total a su subtotal", async () => {
    const f = incompleteCovered();
    f.tables.invoices = [];
    f.tables.shipment_rate_snapshots = Array.from({ length: 61 }, (_, i) => snapshot(`r${i}`, "1.00", "1", "1.00"));
    await renderPage(f);
    expect(screen.getAllByRole("row")).toHaveLength(61); // 60 observadas + encabezado
    expect(kpi("Llegó sin factura").getByText(/Subtotal conocido: \$60\.00/)).toBeInTheDocument();
    expect(kpi("Llegó sin factura").queryByText(/^\$60\.00 a facturar$/)).toBeNull();
    expect(screen.getByRole("status", { name: "Resumen global por facturar" })).toHaveTextContent(/lectura parcial/i);
  });

  it.each(["warehouse_receipts_cn", "shipments", "invoices", "shipment_rate_snapshots"])("error de %s rechaza la página, no fabrica vacío exitoso", async (table) => {
    const f = fixture();
    f.errors = { [table]: { code: "42501", message: `Fallo sintético ${table}` } };
    mocks.createClient.mockResolvedValue(database(f));
    await expect(Page()).rejects.toMatchObject({ message: `Fallo sintético ${table}` });
    expect(screen.queryByText("Al día")).toBeNull();
  });
});

describe("Layout real de Reportes + guard real, con membresía sintética (no RLS)", () => {
  it.each(["accounting", "admin"])("%s puede llegar al reporte", async (role) => {
    const f = fixture();
    f.tables.user_tenants[0].role = role;
    mocks.createClient.mockResolvedValue(database(f));
    render(await ReportesLayout({ children: "Reporte permitido" }));
    expect(screen.getByText("Reporte permitido")).toBeInTheDocument();
  });
  it.each(["commercial", "operations", "warehouse", "support", "marketing"])("%s no abre Reportes ni con override de vista", async (role) => {
    const f = fixture();
    f.tables.user_tenants[0].role = role;
    f.tables.studio_role_module_overrides = [{ role, module_id: "reports", can_view: true, can_edit: true }];
    mocks.createClient.mockResolvedValue(database(f));
    await expect(ReportesLayout({ children: "No visible" })).rejects.toThrow("REDIRECT /studio/dashboard?denied=reports");
    expect(f.reads).not.toContain("invoices");
  });
  it.each(["sin sesión", "membresía desactivada"])("%s no abre Reportes", async (condition) => {
    const f = fixture();
    if (condition === "sin sesión") f.user = null;
    else f.tables.user_tenants[0].disabled_at = "2026-10-01";
    mocks.createClient.mockResolvedValue(database(f));
    await expect(ReportesLayout({ children: "No visible" })).rejects.toThrow("REDIRECT /studio/dashboard?denied=reports");
  });
});
