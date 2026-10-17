/**
 * SDD-0543 · «Mis facturas» con borradores por aceptar: la tarjeta avisa cuántas
 * y cuánto; sin facturas emitidas, el vacío no se contradice con la tarjeta
 * («no tienes facturas» → «no tienes facturas emitidas» y dice cuándo entran al
 * estado de cuenta). Sin borradores, la página de siempre.
 *
 * Se renderiza la página real con sus consultas simuladas; la tarjeta se
 * reemplaza por una que pinta el título que recibe (lo que se prueba es qué le
 * pasa la página).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

const CLIENTE = { id: "c1", markbox: "DTD-8001", name: "Cliente Prueba", email: null, phone: null, address: null };

const h = vi.hoisted(() => ({
  facturas: [] as unknown[],
  pendientes: [] as unknown[],
  principal: null as unknown,
  cargados: [] as unknown[],
}));

vi.mock("@/lib/db/server", () => ({ createClient: async () => ({}) }));
vi.mock("@/lib/db/admin", () => ({ createAdminClient: () => ({}) }));
vi.mock("@/lib/portal/demo", () => ({ showNortePortal: () => false }));
vi.mock("@/lib/portal/portal-queries", () => ({
  // SDD-0549: la página resuelve el principal UNA vez. `getPortalClient` se deja
  // para que una versión que volviera a usarlo corra y falle por la aserción.
  getPortalClientPrincipal: async () => h.principal,
  getPortalClient: async () => (h.principal as { client?: unknown } | null)?.client ?? null,
  listMyInvoices: async () => h.facturas,
  listMyShipments: async () => [],
  listMyEstimates: async () => [],
}));
vi.mock("@/lib/portal/pending-acceptance", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/portal/pending-acceptance")>()),
  loadPendingAcceptanceForClient: async (arg: unknown) => {
    h.cargados.push(arg);
    return h.pendientes;
  },
}));
vi.mock("../_components/PendingAcceptanceCard", () => ({
  PendingAcceptanceCard: (p: { heading?: string }) => <section aria-label="Por aceptar">{p.heading}</section>,
}));

import PortalInvoicesPage from "./page";

const PENDIENTE = { code: "F-2026-0007", baseAmount: 876.78, totalAmount: 876.78, currency: "USD", shipmentCode: "DTD-A116-06", cbm: 1.022, weightKg: 408.55 };

async function abrir() {
  const ui = await PortalInvoicesPage({ searchParams: Promise.resolve({}) });
  render(ui);
}

beforeEach(() => {
  h.principal = { userId: "u1", tenantId: "t1", client: CLIENTE };
});

afterEach(() => {
  cleanup();
  h.facturas = [];
  h.pendientes = [];
  h.principal = null;
  h.cargados = [];
});

describe("/portal/facturas · borradores por aceptar con el principal de sesión (SDD-0549)", () => {
  it("le pasa al loader el tenant y el Shipping Mark del principal", async () => {
    await abrir();
    expect(h.cargados).toHaveLength(1);
    expect(h.cargados[0]).toMatchObject({ tenantId: "t1", client: { markbox: "DTD-8001" } });
  });

  it("sin principal Portal no carga borradores", async () => {
    h.principal = null;
    h.pendientes = [PENDIENTE];
    await abrir();
    expect(h.cargados).toEqual([]);
    expect(screen.queryByRole("region", { name: "Por aceptar" })).toBeNull();
  });
});

describe("/portal/facturas con borradores por aceptar (SDD-0543)", () => {
  it("con una por aceptar y ninguna emitida: tarjeta arriba y un vacío que no la contradice", async () => {
    h.pendientes = [PENDIENTE];
    await abrir();
    expect(screen.getByRole("region", { name: "Por aceptar" })).toHaveTextContent("Tienes 1 factura por aceptar.");
    expect(screen.getByText("Todavía no tienes facturas emitidas.")).toBeInTheDocument();
    expect(screen.getByText(/La factura por aceptar que ves arriba .*entra al estado de cuenta cuando la aceptes y se emita/)).toBeInTheDocument();
    expect(screen.queryByText("Todavía no tienes facturas.")).toBeNull();
  });

  it("con dos por aceptar en la misma moneda el título y el vacío traen la suma", async () => {
    h.pendientes = [PENDIENTE, { ...PENDIENTE, code: "F-2026-0008", totalAmount: 123.22 }];
    await abrir();
    expect(screen.getByRole("region", { name: "Por aceptar" })).toHaveTextContent(/Tienes 2 facturas por aceptar · .*1[.,]000[.,]00/);
    expect(screen.getByText(/Las 2 facturas por aceptar que ves arriba \(.*1[.,]000[.,]00\) entran al estado de cuenta cuando las aceptes y se emitan/)).toBeInTheDocument();
  });

  it("sin borradores por aceptar: ni tarjeta ni mención; el vacío de siempre", async () => {
    await abrir();
    expect(screen.queryByRole("region", { name: "Por aceptar" })).toBeNull();
    expect(screen.getByText("Todavía no tienes facturas.")).toBeInTheDocument();
    expect(screen.getByText(/Cuando tu asesor emita una factura a tu nombre/)).toBeInTheDocument();
    expect(screen.queryByText(/por aceptar/)).toBeNull();
  });
});
