import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  getPortalClientPrincipal: vi.fn(),
  getPrealertaByCode: vi.fn(),
  listarRecepcionesDeCompra: vi.fn(),
  obtenerPackingListDeCompra: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}));
vi.mock("@/lib/portal/portal-queries", () => ({
  getPortalClientPrincipal: mocks.getPortalClientPrincipal,
}));
vi.mock("@/lib/studio/prealertas/queries", () => ({
  getPrealertaByCode: mocks.getPrealertaByCode,
}));
vi.mock("@/lib/portal/purchase-reception-queries", () => ({
  listarRecepcionesDeCompra: mocks.listarRecepcionesDeCompra,
}));
vi.mock("@/lib/portal/packing-list-queries", () => ({
  obtenerPackingListDeCompra: mocks.obtenerPackingListDeCompra,
}));

import { getPortalPurchaseOperationalDetail } from "../purchase-operational-detail";

const db = {} as SupabaseClient;
const empty = {
  recepcion: {
    recepciones: [],
    cajasRecibidas: 0,
    cbmTotal: null,
    pesoTotal: null,
    primeraRecepcion: null,
  },
  packing: null,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getPortalPurchaseOperationalDetail", () => {
  it("rechaza un código vacío antes de consultar o elevar", async () => {
    await expect(getPortalPurchaseOperationalDetail(db, "  ")).resolves.toEqual(
      empty,
    );
    expect(mocks.getPortalClientPrincipal).not.toHaveBeenCalled();
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it("no eleva si el principal no es cliente Portal activo", async () => {
    mocks.getPortalClientPrincipal.mockResolvedValue(null);

    await expect(
      getPortalPurchaseOperationalDetail(db, "PRE-1001"),
    ).resolves.toEqual(empty);
    expect(mocks.getPrealertaByCode).not.toHaveBeenCalled();
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it("no eleva si la sesión/RLS no prueba que la compra sea suya", async () => {
    mocks.getPortalClientPrincipal.mockResolvedValue({
      userId: "portal-user", tenantId: "tenant-1", client: { markbox: "DTD-1001" },
    });
    mocks.getPrealertaByCode.mockResolvedValue(null);

    await expect(
      getPortalPurchaseOperationalDetail(db, "PRE-AJENA"),
    ).resolves.toEqual(empty);
    expect(mocks.getPrealertaByCode).toHaveBeenCalledWith(db, "PRE-AJENA", {
      tenantId: "tenant-1",
      markbox: "DTD-1001",
    });
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it("usa un solo admin y lo acota al id recién autorizado", async () => {
    const admin = { role: "service" };
    const recepcion = { ...empty.recepcion, cajasRecibidas: 3 };
    const packing = { id: "pl-1" };
    mocks.getPortalClientPrincipal.mockResolvedValue({
      userId: "portal-user", tenantId: "tenant-1", client: { markbox: "DTD-1001" },
    });
    mocks.getPrealertaByCode.mockResolvedValue({ id: "pre-1" });
    mocks.createAdminClient.mockReturnValue(admin);
    mocks.listarRecepcionesDeCompra.mockResolvedValue(recepcion);
    mocks.obtenerPackingListDeCompra.mockResolvedValue(packing);

    await expect(
      getPortalPurchaseOperationalDetail(db, " PRE-1001 "),
    ).resolves.toEqual({ recepcion, packing });
    expect(mocks.createAdminClient).toHaveBeenCalledTimes(1);
    expect(mocks.listarRecepcionesDeCompra).toHaveBeenCalledWith(admin, "pre-1");
    expect(mocks.obtenerPackingListDeCompra).toHaveBeenCalledWith(
      admin,
      "pre-1",
      "DTD-1001",
    );
  });

  it("falla cerrado si la elevación no está disponible", async () => {
    mocks.getPortalClientPrincipal.mockResolvedValue({
      userId: "portal-user", tenantId: "tenant-1", client: { markbox: "DTD-1001" },
    });
    mocks.getPrealertaByCode.mockResolvedValue({ id: "pre-1" });
    mocks.createAdminClient.mockImplementation(() => {
      throw new Error("sin service role");
    });

    await expect(
      getPortalPurchaseOperationalDetail(db, "PRE-1001"),
    ).resolves.toEqual(empty);
  });
});
