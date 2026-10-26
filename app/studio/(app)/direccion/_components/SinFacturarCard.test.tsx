/**
 * SDD-0574: tarjeta y MiniStat/Link reales con modelo de la regla real.
 * El caso de cableado ejecuta la página de Dirección y el lector propios;
 * solo sustituye DB y los agregados ajenos al reporte. No acredita RLS ni CSS.
 */
import { Children, createElement, isValidElement, type ComponentProps, type ReactElement, type ReactNode } from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { clasificarSinFacturar, type RecepcionReporte } from "@/lib/studio/rate-snapshots/sin-facturar";
import { SinFacturarCard } from "./SinFacturarCard";
import DireccionPage from "../page";
import DireccionLayout from "../layout";

const mocks = vi.hoisted(() => ({ createClient: vi.fn(), getDireccionData: vi.fn() }));
vi.mock("@/lib/db/server", () => ({ createClient: mocks.createClient }));
vi.mock("next/navigation", () => ({
  redirect: (href: string) => { throw new Error(`REDIRECT ${href}`); },
}));
vi.mock("@/lib/studio/direccion/queries", () => ({
  getDireccionData: mocks.getDireccionData,
  textosFinancieros: () => ({ ingreso: { valor: "$0.00", label: "Ingreso ajeno", periodo: "Fixture", detalle: null }, utilidad: { valor: "$0.00", label: "Utilidad ajena", sub: "Fixture" } }),
}));

const TODAY = new Date("2026-10-21T12:00:00Z");
const receipt = (id: string, shipmentId: string | null = "s1"): RecepcionReporte => ({
  id, receipt_code: `WR-${id}`, client_markbox: `DTD-${id}`, total_cbm: 2, received_at: "2026-10-01", status: "consolidado", shipment_id: shipmentId,
});
const snapshot = (amount = 1700) => ({ amount_to_invoice: amount, per_cbm: amount === 0 ? 1 : 850, cbm: amount === 0 ? 0.001 : 2, min_charge: 0 });
function model(options: { known?: number | null; unknownArrived?: boolean; unknownNotArrived?: boolean; completo?: boolean; tarifasDisponibles?: boolean; empty?: boolean } = {}) {
  const recepciones: RecepcionReporte[] = options.empty ? [] : [receipt("conocida")];
  if (options.unknownArrived) recepciones.push(receipt("faltante"));
  if (options.unknownNotArrived) recepciones.push(receipt("pendiente", null));
  const tarifas: Record<string, ReturnType<typeof snapshot>> = options.empty || options.known === null ? {} : { conocida: snapshot(options.known ?? 1700) };
  const completo = options.completo ?? true;
  const input = {
    recepciones, envios: [{ id: "s1", code: "C-sintetico", status: "arrived_destination", arrived_destination_at: "2026-10-10" }],
    facturas: [], tarifas, hoy: TODAY, lecturaCompleta: completo,
  };
  return { ...clasificarSinFacturar(input), completo, tarifasDisponibles: options.tarifasDisponibles ?? true };
}
function cardLink(label: RegExp) {
  return screen.getByRole("link", { name: label });
}
function status() {
  return screen.getByRole("status", { name: "Resumen global por facturar" });
}
function containsSuccess(element: HTMLElement) {
  return Array.from(element.querySelectorAll<HTMLElement>("[style]")).some((e) => e.style.color === "var(--success)");
}

beforeEach(() => {
  mocks.createClient.mockReset();
  mocks.getDireccionData.mockReset();
  mocks.getDireccionData.mockResolvedValue({ finance: { utilidad: 0, caja: 0, posicionNeta: 0 }, health: {}, forecast: {}, ops: {}, commercial: {}, alerts: [] });
});
afterEach(() => cleanup());

describe("SinFacturarCard real · F1/F3", () => {
  it("F1: Sin tarifa es transversal y conserva llegadas; las tarjetas no se ofrecen como grupos sumables", () => {
    render(createElement(SinFacturarCard, model({ unknownArrived: true, unknownNotArrived: true })));
    expect(within(cardLink(/^Llegó sin factura/)).getByText("2")).toBeInTheDocument();
    expect(within(cardLink(/^Sin tarifa disponible/)).getByText("2")).toBeInTheDocument();
    expect(cardLink(/^Sin tarifa disponible/)).toHaveTextContent(/incluye las que ya llegaron/i);
    expect(status()).toHaveTextContent(/3 recepciones.*2 sin tarifa disponible/);
    expect(status()).toHaveTextContent(/Subtotal conocido: \$1,700\.00/);
    expect(screen.getByText(/El contador sin tarifa se cruza con los estados; no sumes las tarjetas/)).toBeInTheDocument();
  });

  it("F1: todo desconocido no imprime $0 como importe conocido y no pinta éxito por grupo vacío", () => {
    render(createElement(SinFacturarCard, model({ known: null })));
    expect(cardLink(/^Llegó sin factura/)).toHaveTextContent(/Importe no disponible/);
    expect(cardLink(/^Llegó sin factura/)).not.toHaveTextContent("$0.00");
    expect(within(cardLink(/^Sin tarifa disponible/)).getByText("1")).toBeInTheDocument();
    expect(status()).toHaveTextContent(/Importe no disponible/);
    expect(containsSuccess(cardLink(/^Sin tarifa disponible/))).toBe(false);
  });

  it("F1: mezcla de cero conocido y desconocido sí explica el subtotal conocido de cero", () => {
    render(createElement(SinFacturarCard, model({ known: 0, unknownArrived: true })));
    expect(cardLink(/^Llegó sin factura/)).toHaveTextContent(/Subtotal conocido: \$0\.00/);
    expect(cardLink(/^Llegó sin factura/)).not.toHaveTextContent("$0.00 a facturar");
    expect(status()).toHaveTextContent(/1 sin tarifa disponible/);
  });

  it("F1: cero conocido conserva importe cero y no se rotula desconocido", () => {
    render(createElement(SinFacturarCard, model({ known: 0 })));
    expect(cardLink(/^Llegó sin factura/)).toHaveTextContent("$0.00 a facturar");
    expect(cardLink(/^Llegó sin factura/)).not.toHaveTextContent("Importe no disponible");
    expect(status()).toHaveTextContent(/\$0\.00 a facturar/);
  });

  it.each([
    { ultimo: 1_992_547_499.91, visible: "$90,071,992,547,409.91" },
    { ultimo: 1_992_547_499.92, visible: "$90,071,992,547,409.92" },
    { ultimo: 1_992_547_499.93, visible: "$90,071,992,547,409.93" },
  ])("F1 precisión: tarjeta real conserva $visible y no atribuye la magnitud a tarifa ausente", ({ ultimo, visible }) => {
    const tarifas = {
      ...Object.fromEntries(Array.from({ length: 90 }, (_, i) => [`grande-${i}`, { amount_to_invoice: 999_999_999_999, per_cbm: 9_999_999_999.99, cbm: 100, min_charge: 0 }])),
      complemento: { amount_to_invoice: 70_000_000_000, per_cbm: 700_000_000, cbm: 100, min_charge: 0 },
      ultimo: { amount_to_invoice: ultimo, per_cbm: ultimo, cbm: 1, min_charge: 0 },
    };
    const input = {
      recepciones: Object.keys(tarifas).map((id) => receipt(id)),
      envios: [{ id: "s1", code: "C-sintetico", status: "arrived_destination", arrived_destination_at: "2026-10-10" }],
      facturas: [], tarifas, hoy: TODAY,
    };
    const data = clasificarSinFacturar(input);
    render(createElement(SinFacturarCard, { ...data, completo: true, tarifasDisponibles: true }));
    expect(cardLink(/^Llegó sin factura/)).toHaveTextContent(`${visible} a facturar`);
    expect(status()).toHaveTextContent(`${visible} a facturar`);
    expect(status()).toHaveTextContent(/92 recepciones/);
    expect(within(cardLink(/^Sin tarifa disponible/)).getByText("0")).toBeInTheDocument();
    expect(status()).not.toHaveTextContent(/importe no disponible|lectura parcial/i);
  });

  it("F1: falta de 0496 conserva prioridad y explica disponibilidad sin inventar categoría", () => {
    render(createElement(SinFacturarCard, model({ known: null, tarifasDisponibles: false })));
    expect(within(cardLink(/^Llegó sin factura/)).getByText("1")).toBeInTheDocument();
    expect(within(cardLink(/^Sin tarifa disponible/)).getByText("1")).toBeInTheDocument();
    expect(screen.getAllByRole("status").some((e) => /tarifa congelada.*no está disponible/i.test(e.textContent ?? ""))).toBe(true);
    expect(screen.queryByText(/todo cuenta como sin tarifa/i)).toBeNull();
  });

  it("F3: vacío parcial conserva cero observado, sin éxito ni total conocido", () => {
    render(createElement(SinFacturarCard, model({ empty: true, completo: false })));
    expect(within(cardLink(/^Llegó sin factura/)).getByText("0")).toBeInTheDocument();
    expect(status()).toHaveTextContent(/lectura parcial/i);
    expect(status()).toHaveTextContent(/importe no concluyente/i);
    expect(status()).not.toHaveTextContent("$0.00 a facturar");
    expect(containsSuccess(cardLink(/^Llegó sin factura/))).toBe(false);
    expect(containsSuccess(cardLink(/^Sin tarifa disponible/))).toBe(false);
    expect(screen.queryByText("Al día")).toBeNull();
  });

  it("F3: vacío completo puede mostrar cero confirmado", () => {
    render(createElement(SinFacturarCard, model({ empty: true })));
    expect(status()).toHaveTextContent(/0 recepciones/);
    expect(status()).toHaveTextContent("$0.00 a facturar");
    expect(containsSuccess(cardLink(/^Llegó sin factura/))).toBe(true);
    expect(containsSuccess(cardLink(/^Sin tarifa disponible/))).toBe(true);
  });

  it("F3: parcial con monto conserva subtotal con alcance, no total completo", () => {
    render(createElement(SinFacturarCard, model({ completo: false })));
    expect(cardLink(/^Llegó sin factura/)).toHaveTextContent(/Subtotal conocido: \$1,700\.00/);
    expect(cardLink(/^Llegó sin factura/)).not.toHaveTextContent("$1,700.00 a facturar");
    expect(status()).toHaveTextContent(/lectura parcial/i);
  });

  it("todas las tarjetas navegan al reporte con nombre accesible y sin botones de mutación", () => {
    render(createElement(SinFacturarCard, model()));
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(4);
    for (const link of links) {
      expect(link).toHaveAttribute("href", "/studio/reportes/embarques-sin-facturar");
      expect(link).toHaveAccessibleName();
    }
    expect(screen.queryByRole("button")).toBeNull();
  });
});

type Row = Record<string, unknown>;
function session(role = "admin") {
  const tables: Record<string, Row[]> = {
    user_tenants: [{ user_id: "synthetic-user", tenant_id: "synthetic-tenant", role, disabled_at: null }],
    studio_role_module_overrides: [],
    warehouse_receipts_cn: [
      { ...receipt("conocida"), is_orphan: false, deleted_at: null },
      { ...receipt("faltante"), is_orphan: false, deleted_at: null },
    ],
    shipments: [{ id: "s1", code: "C-sintetico", status: "arrived_destination", arrived_destination_at: "2026-10-10" }],
    invoices: [],
    shipment_rate_snapshots: [{ ...snapshot(), id: "t1", receipt_id: "conocida", superseded_at: null, included_kg_per_cbm: 500 }],
  };
  return {
    auth: { getUser: async () => ({ data: { user: { id: "synthetic-user" } }, error: null }) },
    from: (table: string) => {
      const predicates: ((row: Row) => boolean)[] = [];
      let start = 0;
      let end = Infinity;
      const chain: Record<string, unknown> = {};
      const rows = () => (tables[table] ?? []).filter((row) => predicates.every((fn) => fn(row))).slice(start, end + 1);
      chain.select = chain.returns = chain.order = () => chain;
      chain.eq = (key: string, value: unknown) => (predicates.push((row) => row[key] === value), chain);
      chain.is = (key: string, value: unknown) => (predicates.push((row) => (row[key] ?? null) === value), chain);
      chain.in = (key: string, values: unknown[]) => (predicates.push((row) => values.includes(row[key])), chain);
      chain.range = (from: number, to: number) => ((start = from), (end = to), chain);
      chain.limit = (limit: number) => ((end = limit - 1), chain);
      chain.maybeSingle = async () => ({ data: rows()[0] ?? null, error: null });
      chain.then = (resolve: (value: unknown) => unknown) => resolve({ data: rows(), error: null });
      return chain;
    },
  } as unknown as SupabaseClient;
}
function findCard(node: ReactNode): ReactElement<ComponentProps<typeof SinFacturarCard>> | null {
  for (const child of Children.toArray(node)) {
    if (!isValidElement(child)) continue;
    if (child.type === SinFacturarCard) return child as ReactElement<ComponentProps<typeof SinFacturarCard>>;
    const nested = findCard((child.props as { children?: ReactNode }).children);
    if (nested) return nested;
  }
  return null;
}

describe("Dirección RSC -> SinFacturarCard y gates reales, DB sintética (no RLS)", () => {
  it("la página pasa agregado global, faltante y subtotal del lector a la tarjeta real", async () => {
    mocks.createClient.mockResolvedValue(session());
    const card = findCard(await DireccionPage());
    expect(card).not.toBeNull();
    expect(card!.props).toHaveProperty("total", { cantidad: 2, subtotalConocido: "1700.00", sinTarifa: 1, aFacturar: null });
    render(card!);
    expect(status()).toHaveTextContent(/2 recepciones.*1 sin tarifa disponible/);
    expect(cardLink(/^Llegó sin factura/)).toHaveTextContent(/Subtotal conocido: \$1,700\.00/);
  });

  it.each(["accounting", "commercial", "operations", "warehouse", "support", "marketing"])("%s no abre el layout ni la página de Dirección", async (role) => {
    mocks.createClient.mockResolvedValue(session(role));
    await expect(DireccionLayout({ children: "No visible" })).rejects.toThrow("REDIRECT /studio/dashboard?denied=direccion");
    await expect(DireccionPage()).rejects.toThrow("REDIRECT /studio/dashboard");
    expect(mocks.getDireccionData).not.toHaveBeenCalled();
  });

  it("admin pasa el layout de Dirección", async () => {
    mocks.createClient.mockResolvedValue(session());
    render(await DireccionLayout({ children: "Dirección permitida" }));
    expect(screen.getByText("Dirección permitida")).toBeInTheDocument();
  });
});
