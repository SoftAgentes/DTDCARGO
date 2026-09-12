import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  listMyDocuments: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("@/lib/portal/portal-queries", () => ({
  listMyDocuments: mocks.listMyDocuments,
}));

import { SHIPMENT_DOCS_BUCKET } from "@/lib/studio/shipment-document-types";
import { listSignedPortalDocuments } from "../signed-portal-documents";

/**
 * SDD-0342 · L06. Alcance de la firma con el `signDocumentUrls` REAL (sin
 * mock): mismo bucket y mismo TTL que la página usaba en main (default de
 * 3600 s), y sólo paths que la lectura RLS de la sesión devolvió.
 */
const db = {} as SupabaseClient;
const own = {
  id: "doc-1",
  docType: "bl" as const,
  storagePath: "tenant-a/ship-1/bl.pdf",
  fileName: "bl.pdf",
  contentType: "application/pdf",
  sizeBytes: 42,
  createdAt: "2026-09-02T00:00:00Z",
  shipmentCode: "DTDU-0001",
};

function fakeStorage(extra: Record<string, string> = {}) {
  const createSignedUrls = vi.fn(async (...args: [string[], number]) => ({
    data: [
      ...args[0].map((path) => ({ path, signedUrl: `https://storage.test/${path}` })),
      ...Object.entries(extra).map(([path, signedUrl]) => ({ path, signedUrl })),
    ],
    error: null,
  }));
  const from = vi.fn(() => ({ createSignedUrls }));
  return { admin: { storage: { from } }, from, createSignedUrls };
}

beforeEach(() => vi.clearAllMocks());

describe("listSignedPortalDocuments · alcance de la firma", () => {
  it("firma en shipment-docs con TTL de 3600 s sólo los paths leídos por RLS", async () => {
    const storage = fakeStorage();
    mocks.listMyDocuments.mockResolvedValue([own]);
    mocks.createAdminClient.mockReturnValue(storage.admin);

    await expect(listSignedPortalDocuments(db)).resolves.toEqual([
      { document: own, url: `https://storage.test/${own.storagePath}` },
    ]);
    expect(mocks.listMyDocuments).toHaveBeenCalledWith(db);
    expect(storage.from).toHaveBeenCalledWith(SHIPMENT_DOCS_BUCKET);
    expect(storage.createSignedUrls.mock.calls).toEqual([[[own.storagePath], 3600]]);
  });

  it("no expone URLs de paths que RLS no devolvió", async () => {
    const storage = fakeStorage({
      "tenant-b/ship-9/bl.pdf": "https://storage.test/ajeno",
    });
    mocks.listMyDocuments.mockResolvedValue([own]);
    mocks.createAdminClient.mockReturnValue(storage.admin);

    const result = await listSignedPortalDocuments(db);

    expect(result).toEqual([
      { document: own, url: `https://storage.test/${own.storagePath}` },
    ]);
    expect(JSON.stringify(result)).not.toContain("ajeno");
  });

  it("si Storage rechaza, conserva los documentos con URL nula", async () => {
    const storage = fakeStorage();
    storage.createSignedUrls.mockRejectedValue(new Error("storage caído"));
    mocks.listMyDocuments.mockResolvedValue([own]);
    mocks.createAdminClient.mockReturnValue(storage.admin);

    await expect(listSignedPortalDocuments(db)).resolves.toEqual([
      { document: own, url: null },
    ]);
  });
});
