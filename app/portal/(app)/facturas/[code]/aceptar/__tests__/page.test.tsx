/**
 * SDD-0549 · La página de aceptación de T&C lee la orden por aceptar, los
 * documentos vigentes y la aceptación previa con el tenant y el Shipping Mark
 * del principal de sesión, igual que la acción (SDD-0397). Ya no relee
 * `clients.tenant_id` con el admin client.
 *
 * El admin client es un doble que aplica los filtros y trae en `clients` un
 * tenant LEGADO distinto del del principal: la versión anterior de la página lo
 * leía y consultaba la orden con ese tenant, así que esta prueba falla con ella.
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
} from "@/lib/portal/__tests__/portal-tenant-double";

const h = vi.hoisted(() => ({
  principal: null as unknown,
  admin: null as unknown as PortalDouble,
  crearAdmin: vi.fn(),
  getOrder: vi.fn(),
  prevDocs: vi.fn(),
  docs: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
}));
vi.mock("@/lib/db/server", () => ({ createClient: async () => ({}) }));
vi.mock("@/lib/db/admin", () => ({ createAdminClient: () => h.crearAdmin() }));
vi.mock("@/lib/portal/portal-queries", () => ({
  getPortalClientPrincipal: async () => h.principal,
  // Se deja para que una versión que volviera a usarlo corra y falle por la aserción.
  getPortalClient: async () => (h.principal as { client?: unknown } | null)?.client ?? null,
}));
vi.mock("@/lib/portal/portal-legal-queries", () => ({
  getPendingAcceptanceInvoice: h.getOrder,
  latestOrderAcceptanceDocs: h.prevDocs,
}));
vi.mock("@/lib/studio/legal/queries", () => ({ currentClientDocs: h.docs }));
vi.mock("../AcceptanceForm", () => ({
  AcceptanceForm: (p: { invoiceCode: string }) => <form aria-label="Aceptación">{p.invoiceCode}</form>,
}));

import AcceptTermsPage from "../page";

const ORDEN = {
  code: "F-2026-0007",
  invoiceId: "i1",
  shipmentId: "s1",
  shipmentCode: "DTD-A116-06",
  clientName: "Cliente sintético A",
  currency: "USD",
  baseAmount: 876.78,
  ivaRate: 0,
  ivaAmount: 0,
  totalAmount: 876.78,
  fxRate: null,
  cbm: 1.022,
  weightKg: 408.55,
  lines: [{ desc: "Flete DDP", qty: 1, unitPrice: 876.78, shipmentCode: "DTD-A116-06" }],
  notes: null,
  embarques: [{ code: "DTD-A116-06", cbm: 1.022, weightKg: 408.55 }],
};

async function abrir(code = "F-2026-0007") {
  const ui = await AcceptTermsPage({ params: Promise.resolve({ code }) });
  render(ui);
}

beforeEach(() => {
  h.principal = {
    userId: "u1",
    tenantId: TENANT_A,
    client: { id: CLIENT_A, markbox: MARKBOX, name: "Cliente sintético A", email: null, phone: null, address: null },
  };
  h.admin = portalDouble({
    tables: { clients: [{ id: CLIENT_A, tenant_id: TENANT_B, markbox: MARKBOX, deleted_at: null }] },
  });
  h.crearAdmin.mockReset().mockImplementation(() => h.admin.db);
  h.getOrder.mockReset().mockResolvedValue(ORDEN);
  h.prevDocs.mockReset().mockResolvedValue(null);
  h.docs.mockReset().mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
});

describe("/portal/facturas/[code]/aceptar con el principal de sesión (SDD-0549)", () => {
  it("lee orden, documentos vigentes y aceptación previa con el tenant del principal, sin releer clients", async () => {
    await abrir();
    expect(h.getOrder).toHaveBeenCalledTimes(1);
    expect(h.getOrder).toHaveBeenCalledWith(h.admin.db, { tenantId: TENANT_A, markbox: MARKBOX, code: "F-2026-0007" });
    expect(h.docs).toHaveBeenCalledWith(h.admin.db, TENANT_A);
    expect(h.prevDocs).toHaveBeenCalledWith(h.admin.db, { tenantId: TENANT_A, markbox: MARKBOX, orderRef: "DTD-A116-06" });
    expect(h.admin.operations).toEqual([]);
    // Lo que ve el cliente no cambia: la orden y su formulario.
    expect(screen.getByRole("heading", { name: "Confirma tu orden" })).toBeInTheDocument();
    expect(screen.getByRole("form", { name: "Aceptación" })).toHaveTextContent("F-2026-0007");
    expect(screen.getByText("DTD-A116-06")).toBeInTheDocument();
  });

  it("sin principal Portal redirige a /entrar sin construir el admin client", async () => {
    h.principal = null;
    await expect(abrir()).rejects.toThrow("NEXT_REDIRECT:/entrar");
    expect(h.crearAdmin).not.toHaveBeenCalled();
    expect(h.getOrder).not.toHaveBeenCalled();
  });

  it("una orden que ya no espera aceptación vuelve a «Mis facturas»", async () => {
    h.getOrder.mockResolvedValue(null);
    await expect(abrir("F-2026-0099")).rejects.toThrow("NEXT_REDIRECT:/portal/facturas");
    expect(h.docs).not.toHaveBeenCalled();
    expect(h.admin.operations).toEqual([]);
  });
});
