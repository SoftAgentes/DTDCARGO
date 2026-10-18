/**
 * SDD-0552 · «Mis envíos» y el detalle de un envío usan el tenant del principal
 * de sesión en sus lecturas con el admin client: el banner del próximo
 * consolidado (lista) y la orden DDP por aceptar de ese envío (detalle). Ya no
 * releen `clients.tenant_id`.
 *
 * El admin client es un doble que aplica los filtros (incluido `gte` del
 * cut-off), con un tenant LEGADO en `clients` distinto del del principal y un
 * zarpe abierto en cada tenant. `getNextOpenSailing` es el real. Con la versión
 * anterior el banner y la orden por aceptar salían del tenant legado.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import {
  CLIENT_A,
  MARKBOX,
  TENANT_A,
  TENANT_B,
  portalDouble,
  type PortalDouble,
  type Row,
} from "@/lib/portal/__tests__/portal-tenant-double";

const h = vi.hoisted(() => ({
  principal: null as unknown,
  admin: null as unknown as PortalDouble,
  crearAdmin: vi.fn(),
  porAceptar: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
vi.mock("@/lib/db/server", () => ({ createClient: async () => ({ cliente: "sesion" }) }));
vi.mock("@/lib/db/admin", () => ({ createAdminClient: () => h.crearAdmin() }));
vi.mock("@/lib/portal/portal-queries", () => ({
  getPortalClientPrincipal: async () => h.principal,
  // Se deja para que una versión que volviera a usarlo corra y falle por la aserción.
  getPortalClient: async () => (h.principal as { client?: unknown } | null)?.client ?? null,
  listMyShipments: async () => [],
  getMyShipment: async (_db: unknown, code: string) => ({
    id: "ship-a",
    code,
    service: "consolidado_lcl",
    status: "in_transit",
    origin: null,
    destination: null,
    volumeM3: null,
    weightKg: null,
    arrivedDestinationAt: null,
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-02T00:00:00.000Z",
  }),
}));
vi.mock("@/lib/studio/prealertas/queries", () => ({
  listPrealertas: async () => [],
  listSuppliers: async () => [],
  listPrealertaDocuments: async () => [],
}));
vi.mock("@/lib/studio/notifications/portal-visibility-queries", () => ({
  getHiddenPortalStatusesForPortal: async () => new Set(),
}));
vi.mock("@/lib/portal/packing-list-queries", () => ({ prealertasConPackingList: async () => new Set() }));
vi.mock("@/lib/portal/consolidation-queries", () => ({ getConsolidationsForShipments: async () => ({}) }));
vi.mock("@/app/portal/_components/PortalHubTabs", () => ({ EnviosHubTabs: () => null }));
vi.mock("@/app/portal/(app)/envios/_components/PortalAlertasHub", () => ({
  PortalAlertasHub: (p: { banner: { route: string; sentence: string } | null }) => (
    <section aria-label="Próximo consolidado">{p.banner ? p.banner.route : "sin banner"}</section>
  ),
}));
vi.mock("@/lib/portal/shipment-events-queries", () => ({
  listMyShipmentEvents: async () => [],
  stepDatesFromEvents: () => ({}),
}));
vi.mock("@/lib/studio/notifications/notification-history-queries", () => ({
  listShipmentNotificationHistory: async () => [],
}));
vi.mock("@/lib/portal/demo", () => ({ showShipmentAcceptanceCta: () => true }));
vi.mock("@/lib/portal/portal-legal-queries", () => ({ getPendingAcceptanceForShipment: h.porAceptar }));
vi.mock("@/lib/studio/shipment-document-queries", () => ({
  listShipmentDocuments: async () => [],
  signDocumentUrls: async () => ({}),
}));
vi.mock("@/lib/studio/naviera-tracking/queries", () => ({
  getShipmentNaviera: async () => null,
  getShipmentTrackingSnapshot: async () => null,
}));
vi.mock("@/app/portal/(app)/envios/[code]/_components/PortalShipmentDetailNorte", () => ({
  PortalShipmentDetailNorte: (p: { pendingAcceptance: { code: string } | null }) => (
    <section aria-label="Por aceptar">{p.pendingAcceptance?.code ?? "nada por aceptar"}</section>
  ),
}));

import PortalShipmentsPage from "../page";
import PortalShipmentDetailPage from "../[code]/page";

function sailing(id: string, tenantId: string, pol: string): Row {
  return {
    id,
    tenant_id: tenantId,
    vessel: `Buque ${id}`,
    pol,
    pod: "La Guaira",
    etd: "2099-12-01",
    eta: "2099-12-30",
    cutoff: "2099-11-20",
    transit_days: 30,
    space: "alta",
    status: "abierto",
    deleted_at: null,
  };
}

beforeEach(() => {
  h.principal = {
    userId: "u1",
    tenantId: TENANT_A,
    client: { id: CLIENT_A, markbox: MARKBOX, name: "Cliente sintético A", email: null, phone: null, address: null },
  };
  h.admin = portalDouble({
    tables: {
      // Tenant LEGADO en `clients`: la versión anterior lo leía con el admin.
      clients: [{ id: CLIENT_A, tenant_id: TENANT_B, markbox: MARKBOX, deleted_at: null }],
      sailings: [sailing("zarpe-b", TENANT_B, "Shenzhen"), sailing("zarpe-a", TENANT_A, "Ningbo")],
    },
  });
  h.crearAdmin.mockReset().mockImplementation(() => h.admin.db);
  h.porAceptar.mockReset().mockImplementation(async (_db: unknown, args: { tenantId: string }) => ({
    code: args.tenantId === TENANT_A ? "F-A-0001" : "F-B-0009",
  }));
});
afterEach(cleanup);

describe("/portal/envios con el principal de sesión (SDD-0552)", () => {
  it("el banner del próximo consolidado es el zarpe del tenant del principal, sin releer clients", async () => {
    render((await PortalShipmentsPage())!);
    expect(screen.getByRole("region", { name: "Próximo consolidado" })).toHaveTextContent("Ningbo → La Guaira");
    expect(h.admin.on("clients")).toEqual([]);
  });

  it("sin principal no pinta nada ni construye el admin client", async () => {
    h.principal = null;
    expect(await PortalShipmentsPage()).toBeNull();
    expect(h.crearAdmin).not.toHaveBeenCalled();
  });
});

describe("/portal/envios/[code] con el principal de sesión (SDD-0552)", () => {
  it("la orden por aceptar se busca con el tenant y el Shipping Mark del principal, sin releer clients", async () => {
    render(await PortalShipmentDetailPage({ params: Promise.resolve({ code: "DTD-0001-01" }) }));
    expect(h.porAceptar).toHaveBeenCalledWith(h.admin.db, {
      tenantId: TENANT_A,
      markbox: MARKBOX,
      shipmentId: "ship-a",
    });
    expect(screen.getByRole("region", { name: "Por aceptar" })).toHaveTextContent("F-A-0001");
    expect(h.admin.on("clients")).toEqual([]);
  });

  it("sin principal no busca órdenes por aceptar", async () => {
    h.principal = null;
    render(await PortalShipmentDetailPage({ params: Promise.resolve({ code: "DTD-0001-01" }) }));
    expect(h.porAceptar).not.toHaveBeenCalled();
    expect(screen.getByRole("region", { name: "Por aceptar" })).toHaveTextContent("nada por aceptar");
  });
});
