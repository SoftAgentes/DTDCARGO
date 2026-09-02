import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  showShipmentAcceptanceCta: vi.fn(),
  getPendingAcceptanceForShipment: vi.fn(),
  getMyShipment: vi.fn(),
  getPortalClient: vi.fn(),
  listShipmentNotificationHistory: vi.fn(),
  getShipmentNaviera: vi.fn(),
  getShipmentTrackingSnapshot: vi.fn(),
  listShipmentDocuments: vi.fn(),
  signDocumentUrls: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}));
vi.mock("@/lib/portal/demo", () => ({
  showShipmentAcceptanceCta: mocks.showShipmentAcceptanceCta,
}));
vi.mock("@/lib/portal/portal-legal-queries", () => ({
  getPendingAcceptanceForShipment: mocks.getPendingAcceptanceForShipment,
}));
vi.mock("@/lib/portal/portal-queries", () => ({
  getMyShipment: mocks.getMyShipment,
  getPortalClient: mocks.getPortalClient,
}));
vi.mock("@/lib/studio/notifications/notification-history-queries", () => ({
  listShipmentNotificationHistory: mocks.listShipmentNotificationHistory,
}));
vi.mock("@/lib/studio/naviera-tracking/queries", () => ({
  getShipmentNaviera: mocks.getShipmentNaviera,
  getShipmentTrackingSnapshot: mocks.getShipmentTrackingSnapshot,
}));
vi.mock("@/lib/studio/shipment-document-queries", () => ({
  listShipmentDocuments: mocks.listShipmentDocuments,
  signDocumentUrls: mocks.signDocumentUrls,
}));

import { getPortalShipmentPrivateContext } from "../shipment-private-context";

const db = {} as SupabaseClient;
const shipment = { id: "shipment-1", code: "ENV-1" };
const client = { id: "client-1", markbox: "DTD-1001" };
const documents = [
  { id: "doc-1", storage_path: "tenant/shipment-1/bl.pdf" },
];

function makeAdmin() {
  const maybeSingle = vi.fn().mockResolvedValue({
    data: { tenant_id: "tenant-1" },
  });
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });
  return { admin: { from } as unknown as SupabaseClient, from, eq };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getMyShipment.mockResolvedValue(shipment);
  mocks.getPortalClient.mockResolvedValue(client);
  mocks.listShipmentDocuments.mockResolvedValue(documents);
  mocks.showShipmentAcceptanceCta.mockReturnValue(true);
  mocks.signDocumentUrls.mockResolvedValue({
    "tenant/shipment-1/bl.pdf": "https://signed.test/bl",
  });
  mocks.listShipmentNotificationHistory.mockResolvedValue([{ id: "notice-1" }]);
  mocks.getShipmentNaviera.mockResolvedValue({ carrier: "MSC" });
  mocks.getShipmentTrackingSnapshot.mockResolvedValue({ status: "IN_TRANSIT" });
  mocks.getPendingAcceptanceForShipment.mockResolvedValue({ id: "invoice-1" });
});

describe("getPortalShipmentPrivateContext", () => {
  it("rechaza código vacío y envío ajeno sin construir admin", async () => {
    await expect(getPortalShipmentPrivateContext(db, " ")).resolves.toBeNull();
    expect(mocks.getMyShipment).not.toHaveBeenCalled();

    mocks.getMyShipment.mockResolvedValue(null);
    await expect(
      getPortalShipmentPrivateContext(db, "ENV-AJENO"),
    ).resolves.toBeNull();
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
    expect(mocks.listShipmentDocuments).not.toHaveBeenCalled();
  });

  it("si no puede elevar conserva sólo envío y documentos RLS", async () => {
    mocks.createAdminClient.mockImplementation(() => {
      throw new Error("sin service role");
    });

    await expect(
      getPortalShipmentPrivateContext(db, "ENV-1"),
    ).resolves.toMatchObject({
      shipment,
      documents,
      signedUrls: {},
      naviera: null,
      live: null,
      notificationHistory: [],
      pendingAcceptance: null,
    });
    expect(mocks.signDocumentUrls).not.toHaveBeenCalled();
  });

  it("firma y consulta privados sólo con el shipment id comprobado", async () => {
    const { admin, from, eq } = makeAdmin();
    mocks.createAdminClient.mockReturnValue(admin);

    await expect(
      getPortalShipmentPrivateContext(db, " ENV-1 "),
    ).resolves.toMatchObject({
      shipment,
      documents,
      signedUrls: {
        "tenant/shipment-1/bl.pdf": "https://signed.test/bl",
      },
      naviera: { carrier: "MSC" },
      live: { status: "IN_TRANSIT" },
      notificationHistory: [{ id: "notice-1" }],
      pendingAcceptance: { id: "invoice-1" },
    });
    expect(mocks.createAdminClient).toHaveBeenCalledTimes(1);
    expect(mocks.signDocumentUrls).toHaveBeenCalledWith(admin, [
      "tenant/shipment-1/bl.pdf",
    ]);
    expect(mocks.listShipmentNotificationHistory).toHaveBeenCalledWith(
      admin,
      "shipment-1",
    );
    expect(mocks.getShipmentNaviera).toHaveBeenCalledWith(admin, "shipment-1");
    expect(mocks.getShipmentTrackingSnapshot).toHaveBeenCalledWith(
      admin,
      "shipment-1",
    );
    expect(from).toHaveBeenCalledWith("clients");
    expect(eq).toHaveBeenCalledWith("id", "client-1");
    expect(mocks.getPendingAcceptanceForShipment).toHaveBeenCalledWith(admin, {
      tenantId: "tenant-1",
      markbox: "DTD-1001",
      shipmentId: "shipment-1",
    });
  });

  it("respeta el gate del CTA y no busca aceptación para ese cliente", async () => {
    const { admin, from } = makeAdmin();
    mocks.createAdminClient.mockReturnValue(admin);
    mocks.showShipmentAcceptanceCta.mockReturnValue(false);

    await expect(
      getPortalShipmentPrivateContext(db, "ENV-1"),
    ).resolves.toMatchObject({ pendingAcceptance: null });
    expect(from).not.toHaveBeenCalled();
    expect(mocks.getPendingAcceptanceForShipment).not.toHaveBeenCalled();
  });
});
