/**
 * SDD-0552 · La portada y el layout del Portal usan el tenant del principal de
 * sesión para las lecturas con el admin client: el próximo zarpe (portada y
 * píldora del layout) y las órdenes por aceptar (portada). Ya no releen
 * `clients.tenant_id`.
 *
 * El admin client es un doble que aplica los filtros (incluido `gte` del
 * cut-off) y trae en `clients` un tenant LEGADO distinto del del principal, y
 * un zarpe abierto en cada tenant. `getNextOpenSailing` es el real. La versión
 * anterior leía `clients` con el admin y mostraba el zarpe y las órdenes del
 * tenant legado, así que estas pruebas fallan con ella.
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
  pendientes: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("@/lib/fonts", () => ({ jetbrainsMonoUi: { variable: "fuente-mono" } }));
vi.mock("@/lib/db/server", () => ({ createClient: async () => ({ cliente: "sesion" }) }));
vi.mock("@/lib/db/admin", () => ({ createAdminClient: () => h.crearAdmin() }));
vi.mock("@/lib/portal/portal-queries", () => ({
  getPortalClientPrincipal: async () => h.principal,
  // Se deja para que una versión que volviera a usarlo corra y falle por la aserción.
  getPortalClient: async () => (h.principal as { client?: unknown } | null)?.client ?? null,
  getPortalActivation: async () => ({ activated: true, reason: "approved" }),
  getProfileCompleteness: async () => ({ hasPhoto: true, hasAddress: true, complete: true }),
  getDashboardKpis: async () => ({}),
  getNextArrival: async () => null,
  getPortalAdvisor: async () => null,
  listMyShipments: async () => [],
}));
vi.mock("@/lib/portal/portal-legal-queries", () => ({
  listPendingAcceptanceInvoices: h.pendientes,
}));
vi.mock("@/lib/portal/shipment-events-queries", () => ({ listMyRecentActivity: async () => [] }));
vi.mock("@/lib/studio/naviera-tracking/queries", () => ({ getShipmentNaviera: async () => null }));
vi.mock("@/lib/studio/notifications/portal-visibility-queries", () => ({
  getHiddenPortalStatusesForPortal: async () => new Set(),
}));
vi.mock("@/lib/portal/portal-conversation-queries", () => ({ getPortalLastReplyAt: async () => null }));
vi.mock("@/lib/portal/portal-club-queries", () => ({ isPortalClubMember: async () => false }));
vi.mock("@/lib/portal/portal-avisos-queries", () => ({ listMyPortalAvisos: async () => [] }));
vi.mock("@/app/portal/(app)/_components/PortalDashboardNorte", () => ({
  PortalDashboardNorte: (p: { sailing: { vessel: string } | null }) => (
    <section aria-label="Tablero">{p.sailing?.vessel ?? "sin zarpe"}</section>
  ),
}));
vi.mock("@/app/portal/(app)/_components/PendingAcceptanceCard", () => ({
  PendingAcceptanceCard: (p: { pending: { code: string }[] }) => (
    <section aria-label="Por aceptar">{p.pending.map((x) => x.code).join(",")}</section>
  ),
}));
vi.mock("@/app/portal/(app)/_components/ProfileIncompleteCard", () => ({ ProfileIncompleteCard: () => null }));
vi.mock("@/app/portal/(app)/_components/PortalAdvisorCard", () => ({ PortalAdvisorCard: () => null }));
vi.mock("@/app/portal/_components/PortalPushOptIn", () => ({ PortalPushOptIn: () => null }));
vi.mock("@/app/portal/_components/PortalPending", () => ({ PortalPending: () => null }));
vi.mock("@/app/portal/_components/PortalShell", () => ({
  PortalShell: (p: { sailing: { vessel: string } | null; children: React.ReactNode }) => (
    <div>
      <section aria-label="Píldora de zarpe">{p.sailing?.vessel ?? "sin zarpe"}</section>
      {p.children}
    </div>
  ),
}));
vi.mock("@/app/portal/_components/PortalCalcFab", () => ({ PortalCalcFab: () => null }));
vi.mock("@/app/portal/_components/PortalPushRegister", () => ({ PortalPushRegister: () => null }));
vi.mock("@/app/portal/_components/PortalMaintenanceNotice", () => ({ PortalMaintenanceNotice: () => null }));

import PortalHomePage from "../page";
import PortalAppLayout from "../layout";

function sailing(id: string, tenantId: string, vessel: string): Row {
  return {
    id,
    tenant_id: tenantId,
    vessel,
    pol: "Ningbo",
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
      sailings: [sailing("zarpe-b", TENANT_B, "Buque del tenant B"), sailing("zarpe-a", TENANT_A, "Buque del tenant A")],
    },
  });
  h.crearAdmin.mockReset().mockImplementation(() => h.admin.db);
  h.pendientes.mockReset().mockImplementation(async (_db: unknown, args: { tenantId: string }) => [
    { code: args.tenantId === TENANT_A ? "F-A-0001" : "F-B-0009" },
  ]);
});
afterEach(cleanup);

describe("/portal · portada con el principal de sesión (SDD-0552)", () => {
  it("el próximo zarpe y las órdenes por aceptar son del tenant del principal, sin releer clients", async () => {
    render((await PortalHomePage())!);
    expect(screen.getByRole("region", { name: "Tablero" })).toHaveTextContent("Buque del tenant A");
    expect(screen.getByRole("region", { name: "Por aceptar" })).toHaveTextContent("F-A-0001");
    expect(h.pendientes).toHaveBeenCalledWith(h.admin.db, { tenantId: TENANT_A, markbox: MARKBOX });
    expect(h.admin.on("clients")).toEqual([]);
    expect(h.admin.on("sailings").map((op) => op.filters)).toEqual([
      expect.arrayContaining([{ column: "tenant_id", op: "eq", value: TENANT_A }]),
    ]);
  });

  it("sin principal no pinta nada ni construye el admin client", async () => {
    h.principal = null;
    expect(await PortalHomePage()).toBeNull();
    expect(h.crearAdmin).not.toHaveBeenCalled();
  });
});

describe("/portal · layout con el principal de sesión (SDD-0552)", () => {
  it("la píldora del próximo zarpe es del tenant del principal, sin releer clients", async () => {
    render(await PortalAppLayout({ children: <p>contenido</p> }));
    expect(screen.getByRole("region", { name: "Píldora de zarpe" })).toHaveTextContent("Buque del tenant A");
    expect(screen.getByText("contenido")).toBeInTheDocument();
    expect(h.admin.on("clients")).toEqual([]);
  });

  it("sin principal redirige a /entrar", async () => {
    h.principal = null;
    await expect(PortalAppLayout({ children: null })).rejects.toThrow("NEXT_REDIRECT:/entrar");
  });
});
