import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  listMyDocuments: vi.fn(),
  signDocumentUrls: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("@/lib/portal/portal-queries", () => ({
  listMyDocuments: mocks.listMyDocuments,
}));
vi.mock("@/lib/studio/shipment-document-queries", () => ({
  signDocumentUrls: mocks.signDocumentUrls,
}));

import { listSignedPortalDocuments } from "../signed-portal-documents";

const db = {} as SupabaseClient;
const document = {
  id: "doc-1",
  docType: "bl" as const,
  storagePath: "tenant-a/ship-1/bl.pdf",
  fileName: "bl.pdf",
  contentType: "application/pdf",
  sizeBytes: 42,
  createdAt: "2026-09-02T00:00:00Z",
  shipmentCode: "DTDU-0001",
};

beforeEach(() => vi.clearAllMocks());

describe("listSignedPortalDocuments", () => {
  it("firma sólo los paths de documentos recién autorizados por RLS", async () => {
    const admin = { storage: {} };
    mocks.listMyDocuments.mockResolvedValue([document]);
    mocks.createAdminClient.mockReturnValue(admin);
    mocks.signDocumentUrls.mockResolvedValue({
      [document.storagePath]: "https://storage.test/bl",
    });

    await expect(listSignedPortalDocuments(db)).resolves.toEqual([
      { document, url: "https://storage.test/bl" },
    ]);
    expect(mocks.listMyDocuments).toHaveBeenCalledWith(db);
    expect(mocks.signDocumentUrls).toHaveBeenCalledWith(admin, [
      document.storagePath,
    ]);
  });

  it("no eleva cuando RLS no devuelve documentos", async () => {
    mocks.listMyDocuments.mockResolvedValue([]);
    await expect(listSignedPortalDocuments(db)).resolves.toEqual([]);
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it("falla cerrado con URLs nulas si la firma falla", async () => {
    mocks.listMyDocuments.mockResolvedValue([document]);
    mocks.createAdminClient.mockImplementation(() => {
      throw new Error("sin storage");
    });
    await expect(listSignedPortalDocuments(db)).resolves.toEqual([
      { document, url: null },
    ]);
  });
});
