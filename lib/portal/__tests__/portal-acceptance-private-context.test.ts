import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  getPendingAcceptanceInvoice: vi.fn(),
  latestOrderAcceptanceDocs: vi.fn(),
  getPortalClientPrincipal: vi.fn(),
  currentClientDocs: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("@/lib/portal/portal-legal-queries", () => ({
  getPendingAcceptanceInvoice: mocks.getPendingAcceptanceInvoice,
  latestOrderAcceptanceDocs: mocks.latestOrderAcceptanceDocs,
}));
vi.mock("@/lib/portal/portal-queries", () => ({
  getPortalClientPrincipal: mocks.getPortalClientPrincipal,
}));
vi.mock("@/lib/studio/legal/queries", () => ({
  currentClientDocs: mocks.currentClientDocs,
}));

import { getPortalAcceptancePrivateContext } from "../portal-acceptance-private-context";

const db = {} as SupabaseClient;
const client = { id: "client-1", markbox: "DTD-1001" };
const principal = { userId: "portal-user", tenantId: "tenant-1", client };
const order = {
  code: "INV-1",
  shipmentCode: "SHP-1",
  currency: "USD",
  lines: [],
};
const docs = [{ key: "tyc", name: "Términos", version: "v3" }];
const previousDocs = [{ key: "tyc", version: "v2", body_sha256: "abc" }];

function makeAdmin() {
  return { admin: { role: "service" } as unknown as SupabaseClient };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getPortalClientPrincipal.mockResolvedValue(principal);
  mocks.getPendingAcceptanceInvoice.mockResolvedValue(order);
  mocks.currentClientDocs.mockResolvedValue(docs);
  mocks.latestOrderAcceptanceDocs.mockResolvedValue(previousDocs);
});

describe("getPortalAcceptancePrivateContext", () => {
  it("no construye admin cuando no hay cliente Portal", async () => {
    mocks.getPortalClientPrincipal.mockResolvedValue(null);

    await expect(
      getPortalAcceptancePrivateContext(db, "INV-1"),
    ).resolves.toEqual({ state: "unauthenticated" });
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it("rechaza un código vacío antes de elevar", async () => {
    await expect(getPortalAcceptancePrivateContext(db, "  ")).resolves.toEqual({
      state: "unavailable",
    });
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it("acota orden y documentos a la identidad resuelta por sesión", async () => {
    const { admin } = makeAdmin();
    mocks.createAdminClient.mockReturnValue(admin);

    await expect(
      getPortalAcceptancePrivateContext(db, " INV-1 "),
    ).resolves.toEqual({ state: "ready", order, docs, previousDocs });
    expect(mocks.createAdminClient).toHaveBeenCalledTimes(1);
    expect(mocks.getPendingAcceptanceInvoice).toHaveBeenCalledWith(admin, {
      tenantId: "tenant-1",
      markbox: "DTD-1001",
      code: "INV-1",
    });
    expect(mocks.currentClientDocs).toHaveBeenCalledWith(admin, "tenant-1");
    expect(mocks.latestOrderAcceptanceDocs).toHaveBeenCalledWith(admin, {
      tenantId: "tenant-1",
      markbox: "DTD-1001",
      orderRef: "SHP-1",
    });
  });

  it("una orden ajena o ya aceptada no carga documentos", async () => {
    const { admin } = makeAdmin();
    mocks.createAdminClient.mockReturnValue(admin);
    mocks.getPendingAcceptanceInvoice.mockResolvedValue(null);

    await expect(
      getPortalAcceptancePrivateContext(db, "INV-AJENA"),
    ).resolves.toEqual({ state: "unavailable" });
    expect(mocks.currentClientDocs).not.toHaveBeenCalled();
    expect(mocks.latestOrderAcceptanceDocs).not.toHaveBeenCalled();
  });

  it("falla cerrado si no puede crear admin", async () => {
    mocks.createAdminClient.mockImplementationOnce(() => {
      throw new Error("sin service role");
    });
    await expect(
      getPortalAcceptancePrivateContext(db, "INV-1"),
    ).resolves.toEqual({ state: "unavailable" });

  });

  it("falla cerrado si no puede leer el set legal vigente", async () => {
    const { admin } = makeAdmin();
    mocks.createAdminClient.mockReturnValue(admin);
    mocks.currentClientDocs.mockRejectedValue(new Error("sin documentos"));

    await expect(
      getPortalAcceptancePrivateContext(db, "INV-1"),
    ).resolves.toEqual({ state: "unavailable" });
  });
});
