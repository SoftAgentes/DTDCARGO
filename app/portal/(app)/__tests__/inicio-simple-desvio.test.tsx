/**
 * SDD-0654 fase 2 · el desvío del inicio según la vista (`page.tsx`).
 *
 *   · Interruptor apagado: el inicio de siempre y ni se consulta la vista (AC-1).
 *   · Encendido y Vista Pro: el inicio de siempre.
 *   · Encendido y Vista simple: el inicio simple, con la guía según lo que diga
 *     la base, y sin las tarjetas que empujan el contenido.
 *   · Cliente no activado: la pantalla de espera en las dos vistas, y la guía no
 *     arranca (AC-18).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

const h = vi.hoisted(() => ({
  encendido: false,
  vista: { vista: "pro" as "pro" | "simple", guiaVista: true },
  activado: true,
  getMyPortalVista: vi.fn(),
  cargar: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
}));
vi.mock("@/lib/db/server", () => ({ createClient: async () => ({ cliente: "sesion" }) }));
vi.mock("@/lib/db/admin", () => ({ createAdminClient: () => ({ cliente: "admin" }) }));
vi.mock("@/lib/portal/vista-preferida", () => ({
  isPortalVistaSimpleEnabled: () => h.encendido,
  getMyPortalVista: (...a: unknown[]) => h.getMyPortalVista(...a),
}));
vi.mock("@/lib/portal/simple/cargar", () => ({ cargarInicioSimple: (...a: unknown[]) => h.cargar(...a) }));
vi.mock("@/lib/portal/portal-queries", () => ({
  getPortalClientPrincipal: async () => ({
    userId: "aaaaaaaa-0654-0000-0000-000000000001",
    tenantId: "10000000-0654-0000-0000-000000000001",
    client: { id: "c1", markbox: "DTD-9999", name: "Cliente Demo" },
  }),
  getPortalActivation: async () => ({ activated: h.activado, reason: h.activado ? "approved" : null }),
  getProfileCompleteness: async () => ({ hasPhoto: true, hasAddress: true, complete: true }),
  getDashboardKpis: async () => ({}),
  getNextArrival: async () => null,
  getPortalAdvisor: async () => null,
  listMyShipments: async () => [],
}));
vi.mock("@/lib/portal/pending-acceptance", () => ({ loadPendingAcceptanceForClient: async () => [] }));
vi.mock("@/lib/portal/shipment-events-queries", () => ({ listMyRecentActivity: async () => [] }));
vi.mock("@/lib/portal/next-sailing-queries", () => ({ getNextOpenSailing: async () => null, daysUntil: () => null }));
vi.mock("@/lib/studio/naviera-tracking/queries", () => ({ getShipmentNaviera: async () => null }));
vi.mock("@/lib/studio/notifications/portal-visibility-queries", () => ({
  getHiddenPortalStatusesForPortal: async () => new Set(),
}));
vi.mock("@/app/portal/(app)/_components/PortalDashboardNorte", () => ({
  PortalDashboardNorte: () => <section aria-label="Inicio de siempre" />,
}));
vi.mock("@/app/portal/(app)/_components/PendingAcceptanceCard", () => ({ PendingAcceptanceCard: () => null }));
vi.mock("@/app/portal/(app)/_components/ProfileIncompleteCard", () => ({ ProfileIncompleteCard: () => null }));
vi.mock("@/app/portal/(app)/_components/PortalAdvisorCard", () => ({ PortalAdvisorCard: () => null }));
vi.mock("@/app/portal/_components/PortalPushOptIn", () => ({
  PortalPushOptIn: () => <section aria-label="Tarjeta de notificaciones" />,
}));
vi.mock("@/app/portal/_components/PortalPending", () => ({
  PortalPending: () => <section aria-label="Pantalla de espera" />,
}));
vi.mock("@/app/portal/(app)/_simple/InicioSimple", () => ({
  InicioSimple: (p: { guiaVista: boolean; datos: { saludo: { markbox: string } } }) => (
    <section aria-label="Inicio simple" data-guia-vista={String(p.guiaVista)} data-markbox={p.datos.saludo.markbox} />
  ),
}));

const { default: PortalHomePage } = await import("../page");

const DATOS = {
  nombre: "Cliente Demo",
  markbox: "DTD-9999",
  nextArrival: null,
  shipments: [],
  ocultos: { ok: true, ocultos: new Set() },
  kpis: {
    activeShipments: 0,
    deliveredYtd: 0,
    invoicesAvailable: true,
    invoicedTotal: 0,
    outstandingBalance: 0,
    currency: "USD",
    mixedCurrencies: false,
    pendingInvoiceCount: 0,
  },
  profile: { hasPhoto: true, hasAddress: true, complete: true },
  pendingAcceptanceCodes: [],
  documentos: [],
  proveedores: [],
  asesor: null,
  seguimientoEnConstruccion: true,
};

beforeEach(() => {
  h.encendido = false;
  h.vista = { vista: "pro", guiaVista: true };
  h.activado = true;
  h.getMyPortalVista.mockReset().mockImplementation(async () => h.vista);
  h.cargar.mockReset().mockResolvedValue(DATOS);
});
afterEach(cleanup);

async function pintar() {
  render(await PortalHomePage());
}

describe("desvío del inicio según la vista", () => {
  it("interruptor apagado: el inicio de siempre y no se consulta la vista (AC-1)", async () => {
    h.vista = { vista: "simple", guiaVista: false };
    await pintar();
    expect(screen.getByLabelText("Inicio de siempre")).toBeInTheDocument();
    expect(screen.queryByLabelText("Inicio simple")).not.toBeInTheDocument();
    expect(h.getMyPortalVista).not.toHaveBeenCalled();
    expect(h.cargar).not.toHaveBeenCalled();
  });

  it("encendido y Vista Pro: el inicio de siempre", async () => {
    h.encendido = true;
    await pintar();
    expect(screen.getByLabelText("Inicio de siempre")).toBeInTheDocument();
    expect(h.cargar).not.toHaveBeenCalled();
  });

  it("encendido y Vista simple: el inicio simple, sin las tarjetas que empujan", async () => {
    h.encendido = true;
    h.vista = { vista: "simple", guiaVista: false };
    await pintar();
    const simple = screen.getByLabelText("Inicio simple");
    expect(simple).toHaveAttribute("data-guia-vista", "false");
    expect(simple).toHaveAttribute("data-markbox", "DTD-9999");
    expect(screen.queryByLabelText("Inicio de siempre")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Tarjeta de notificaciones")).not.toBeInTheDocument();
    expect(h.getMyPortalVista).toHaveBeenCalledWith({ cliente: "sesion" }, "aaaaaaaa-0654-0000-0000-000000000001");
    expect(h.cargar).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["pro", false],
    ["simple", true],
  ] as const)("cliente no activado con Vista %s: pantalla de espera y la guía no arranca (AC-18)", async (vista, encendido) => {
    h.encendido = encendido;
    h.activado = false;
    h.vista = { vista, guiaVista: false };
    await pintar();
    expect(screen.getByLabelText("Pantalla de espera")).toBeInTheDocument();
    expect(screen.queryByLabelText("Inicio simple")).not.toBeInTheDocument();
    expect(h.cargar).not.toHaveBeenCalled();
  });
});
