import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  getNextOpenSailing: vi.fn(),
  listPendingAcceptanceInvoices: vi.fn(),
  getDashboardKpis: vi.fn(),
  getNextArrival: vi.fn(),
  getPortalActivation: vi.fn(),
  getPortalAdvisor: vi.fn(),
  getPortalClientPrincipal: vi.fn(),
  getProfileCompleteness: vi.fn(),
  listMyShipments: vi.fn(),
  listMyRecentActivity: vi.fn(),
  getHiddenPortalStatusesForPortal: vi.fn(),
  getShipmentNaviera: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("@/lib/portal/next-sailing-queries", () => ({
  getNextOpenSailing: mocks.getNextOpenSailing,
}));
vi.mock("@/lib/portal/portal-legal-queries", () => ({
  listPendingAcceptanceInvoices: mocks.listPendingAcceptanceInvoices,
}));
vi.mock("@/lib/portal/portal-queries", () => ({
  getDashboardKpis: mocks.getDashboardKpis,
  getNextArrival: mocks.getNextArrival,
  getPortalActivation: mocks.getPortalActivation,
  getPortalAdvisor: mocks.getPortalAdvisor,
  getPortalClientPrincipal: mocks.getPortalClientPrincipal,
  getProfileCompleteness: mocks.getProfileCompleteness,
  listMyShipments: mocks.listMyShipments,
}));
vi.mock("@/lib/portal/shipment-events-queries", () => ({
  listMyRecentActivity: mocks.listMyRecentActivity,
}));
vi.mock("@/lib/studio/notifications/portal-visibility-queries", () => ({
  getHiddenPortalStatusesForPortal: mocks.getHiddenPortalStatusesForPortal,
}));
vi.mock("@/lib/studio/naviera-tracking/queries", () => ({
  getShipmentNaviera: mocks.getShipmentNaviera,
}));

import { getPortalHomePrivateContext } from "../portal-home-private-context";

const db = {} as SupabaseClient;
const client = { id: "client-1", name: "Cliente", markbox: "DTD-1001" };
const principal = { userId: "portal-user", tenantId: "tenant-1", client };
const kpis = { inTransit: 2 };
const nextArrival = { id: "shipment-1", code: "SHP-1" };
const rawShipments = [{ id: "shipment-1", status: "in_transit" }];
const profile = { complete: true, hasPhoto: true, hasAddress: true };
const activity = [{ id: "event-1" }];
const hiddenStatuses = new Set(["in_customs"]);
const advisor = { id: "advisor-1", name: "Asesor" };

function makeAdmin() {
  return { admin: { role: "service" } as unknown as SupabaseClient };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getPortalClientPrincipal.mockResolvedValue(principal);
  mocks.getPortalActivation.mockResolvedValue({ activated: true });
  mocks.getDashboardKpis.mockResolvedValue(kpis);
  mocks.getNextArrival.mockResolvedValue(nextArrival);
  mocks.listMyShipments.mockResolvedValue(rawShipments);
  mocks.getProfileCompleteness.mockResolvedValue(profile);
  mocks.listMyRecentActivity.mockResolvedValue(activity);
  mocks.getHiddenPortalStatusesForPortal.mockResolvedValue(hiddenStatuses);
  mocks.getPortalAdvisor.mockResolvedValue(advisor);
  mocks.listPendingAcceptanceInvoices.mockResolvedValue([{ code: "INV-1" }]);
  mocks.getShipmentNaviera.mockResolvedValue({ vessel: "BARCO" });
  mocks.getNextOpenSailing.mockResolvedValue({ id: "sailing-1" });
});

describe("getPortalHomePrivateContext", () => {
  it("no consulta activación ni eleva sin cliente Portal", async () => {
    mocks.getPortalClientPrincipal.mockResolvedValue(null);

    await expect(getPortalHomePrivateContext(db)).resolves.toBeNull();
    expect(mocks.getPortalActivation).not.toHaveBeenCalled();
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it("una cuenta pendiente no carga dashboard ni construye admin", async () => {
    mocks.getPortalActivation.mockResolvedValue({ activated: false });

    await expect(getPortalHomePrivateContext(db)).resolves.toEqual({
      state: "pending",
      client,
    });
    expect(mocks.getDashboardKpis).not.toHaveBeenCalled();
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it("acota los tres derivados privados a identidad e ids de sesión", async () => {
    const { admin } = makeAdmin();
    mocks.createAdminClient.mockReturnValue(admin);

    await expect(getPortalHomePrivateContext(db)).resolves.toMatchObject({
      state: "active",
      client,
      kpis,
      rawNextArrival: nextArrival,
      rawShipments,
      profile,
      activity,
      hiddenStatuses,
      advisor,
      pendingAcceptance: [{ code: "INV-1" }],
      nextArrivalNaviera: { vessel: "BARCO" },
      sailing: { id: "sailing-1" },
    });
    expect(mocks.createAdminClient).toHaveBeenCalledTimes(1);
    expect(mocks.listPendingAcceptanceInvoices).toHaveBeenCalledWith(admin, {
      tenantId: "tenant-1",
      markbox: "DTD-1001",
    });
    expect(mocks.getShipmentNaviera).toHaveBeenCalledWith(admin, "shipment-1");
    expect(mocks.getNextOpenSailing).toHaveBeenCalledWith(
      admin,
      "tenant-1",
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    );
  });

  it("un fallo al elevar conserva todo el contexto de sesión", async () => {
    mocks.createAdminClient.mockImplementation(() => {
      throw new Error("sin service role");
    });

    await expect(getPortalHomePrivateContext(db)).resolves.toMatchObject({
      state: "active",
      client,
      kpis,
      rawNextArrival: nextArrival,
      rawShipments,
      profile,
      activity,
      hiddenStatuses,
      advisor,
      pendingAcceptance: [],
      nextArrivalNaviera: null,
      sailing: null,
    });
    expect(mocks.listPendingAcceptanceInvoices).not.toHaveBeenCalled();
    expect(mocks.getShipmentNaviera).not.toHaveBeenCalled();
    expect(mocks.getNextOpenSailing).not.toHaveBeenCalled();
  });
});
