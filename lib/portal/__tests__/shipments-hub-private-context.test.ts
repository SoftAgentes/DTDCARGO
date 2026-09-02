import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  getConsolidationsForShipments: vi.fn(),
  getNextOpenSailing: vi.fn(),
  prealertasConPackingList: vi.fn(),
  getPortalClient: vi.fn(),
  listMyShipments: vi.fn(),
  getHiddenPortalStatusesForPortal: vi.fn(),
  listPrealertaDocumentPresence: vi.fn(),
  listPrealertas: vi.fn(),
  listSuppliers: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("@/lib/portal/consolidation-queries", () => ({
  getConsolidationsForShipments: mocks.getConsolidationsForShipments,
}));
vi.mock("@/lib/portal/next-sailing-queries", () => ({
  getNextOpenSailing: mocks.getNextOpenSailing,
}));
vi.mock("@/lib/portal/packing-list-queries", () => ({
  prealertasConPackingList: mocks.prealertasConPackingList,
}));
vi.mock("@/lib/portal/portal-queries", () => ({
  getPortalClient: mocks.getPortalClient,
  listMyShipments: mocks.listMyShipments,
}));
vi.mock("@/lib/studio/notifications/portal-visibility-queries", () => ({
  getHiddenPortalStatusesForPortal: mocks.getHiddenPortalStatusesForPortal,
}));
vi.mock("@/lib/studio/prealertas/queries", () => ({
  listPrealertaDocumentPresence: mocks.listPrealertaDocumentPresence,
  listPrealertas: mocks.listPrealertas,
  listSuppliers: mocks.listSuppliers,
}));

import { getPortalShipmentsHubPrivateContext } from "../shipments-hub-private-context";

const db = {} as SupabaseClient;
const client = { id: "client-1", markbox: "DTD-1001" };
const rawShipments = [
  { id: "shipment-1", status: "in_transit" },
  { id: "shipment-2", status: "delivered" },
];
const prealertas = [
  { id: "pre-live", status: "anunciada", shipment_id: null },
  { id: "pre-cancelled", status: "cancelada", shipment_id: null },
  { id: "pre-graduated", status: "recibida", shipment_id: "shipment-1" },
];
const suppliers = [{ id: "supplier-1", name: "Fábrica" }];
const hiddenStatuses = new Set(["in_customs"]);
const docEntries = [{ prealerta_id: "pre-live", doc_type: "foto" }];

function makeAdmin() {
  const maybeSingle = vi.fn().mockResolvedValue({ data: { tenant_id: "tenant-1" } });
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });
  return { admin: { from } as unknown as SupabaseClient, from, eq };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getPortalClient.mockResolvedValue(client);
  mocks.listMyShipments.mockResolvedValue(rawShipments);
  mocks.listPrealertas.mockResolvedValue(prealertas);
  mocks.listSuppliers.mockResolvedValue(suppliers);
  mocks.getHiddenPortalStatusesForPortal.mockResolvedValue(hiddenStatuses);
  mocks.listPrealertaDocumentPresence.mockResolvedValue(docEntries);
  mocks.prealertasConPackingList.mockResolvedValue(new Set(["pre-live"]));
  mocks.getConsolidationsForShipments.mockResolvedValue({
    "shipment-1": "CONT-1",
  });
  mocks.getNextOpenSailing.mockResolvedValue({ id: "sailing-1" });
});

describe("getPortalShipmentsHubPrivateContext", () => {
  it("no consulta ni eleva si el principal no es cliente Portal", async () => {
    mocks.getPortalClient.mockResolvedValue(null);

    await expect(getPortalShipmentsHubPrivateContext(db)).resolves.toBeNull();
    expect(mocks.listMyShipments).not.toHaveBeenCalled();
    expect(mocks.listPrealertas).not.toHaveBeenCalled();
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it("acota packing, consolidaciones y zarpe a conjuntos de sesión", async () => {
    const { admin, from, eq } = makeAdmin();
    mocks.createAdminClient.mockReturnValue(admin);

    await expect(getPortalShipmentsHubPrivateContext(db)).resolves.toMatchObject({
      client,
      rawShipments,
      prealertas,
      suppliers,
      hiddenStatuses,
      docEntries,
      conPackingOnline: new Set(["pre-live"]),
      consolidations: { "shipment-1": "CONT-1" },
      sailing: { id: "sailing-1" },
    });
    expect(mocks.createAdminClient).toHaveBeenCalledTimes(1);
    expect(mocks.listPrealertaDocumentPresence).toHaveBeenCalledWith(db, {
      prealertaIds: ["pre-live"],
      markbox: "DTD-1001",
    });
    expect(mocks.prealertasConPackingList).toHaveBeenCalledWith(
      admin,
      ["pre-live"],
      "DTD-1001",
    );
    expect(mocks.getConsolidationsForShipments).toHaveBeenCalledWith(admin, [
      "shipment-1",
      "shipment-2",
    ]);
    expect(from).toHaveBeenCalledWith("clients");
    expect(eq).toHaveBeenCalledWith("id", "client-1");
    expect(mocks.getNextOpenSailing).toHaveBeenCalledWith(
      admin,
      "tenant-1",
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    );
  });

  it("si no puede elevar conserva lo RLS y vacía los derivados internos", async () => {
    mocks.createAdminClient.mockImplementation(() => {
      throw new Error("sin service role");
    });

    await expect(getPortalShipmentsHubPrivateContext(db)).resolves.toMatchObject({
      client,
      rawShipments,
      prealertas,
      suppliers,
      hiddenStatuses,
      docEntries,
      conPackingOnline: new Set(),
      consolidations: {},
      sailing: null,
    });
    expect(mocks.prealertasConPackingList).not.toHaveBeenCalled();
    expect(mocks.getConsolidationsForShipments).not.toHaveBeenCalled();
  });

  it("degrada errores de fuentes RLS a colecciones vacías", async () => {
    const { admin } = makeAdmin();
    mocks.createAdminClient.mockReturnValue(admin);
    mocks.listMyShipments.mockRejectedValue(new Error("sin envíos"));
    mocks.listPrealertas.mockRejectedValue(new Error("sin compras"));
    mocks.listSuppliers.mockRejectedValue(new Error("sin proveedores"));
    mocks.listPrealertaDocumentPresence.mockRejectedValue(new Error("sin docs"));

    await expect(getPortalShipmentsHubPrivateContext(db)).resolves.toMatchObject({
      rawShipments: [],
      prealertas: [],
      suppliers: [],
      docEntries: [],
    });
    expect(mocks.prealertasConPackingList).toHaveBeenCalledWith(
      admin,
      [],
      "DTD-1001",
    );
    expect(mocks.getConsolidationsForShipments).toHaveBeenCalledWith(admin, []);
  });
});
