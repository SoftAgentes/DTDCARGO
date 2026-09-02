import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  listPrealertaDocuments: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}));
vi.mock("@/lib/studio/prealertas/queries", () => ({
  listPrealertaDocuments: mocks.listPrealertaDocuments,
}));

import { listSignedPrealertaDocuments } from "../prealerta-document-signing";

const db = {} as SupabaseClient;
const docs = [
  {
    id: "doc-1",
    tenant_id: "tenant-a",
    prealerta_id: "pre-1",
    client_markbox: "DTD-1001",
    doc_type: "packing",
    storage_path: "tenant-a/pre-1/packing.pdf",
    file_name: "packing.pdf",
    content_type: "application/pdf",
    size_bytes: 12,
    source: "client",
    created_at: "2026-09-02T00:00:00Z",
  },
] as const;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("listSignedPrealertaDocuments", () => {
  it("firma sólo el path recién autorizado por la consulta RLS", async () => {
    mocks.listPrealertaDocuments.mockResolvedValue(docs);
    const createSignedUrl = vi.fn().mockResolvedValue({
      data: { signedUrl: "https://storage.example.test/signed" },
    });
    const from = vi.fn().mockReturnValue({ createSignedUrl });
    mocks.createAdminClient.mockReturnValue({ storage: { from } });

    await expect(
      listSignedPrealertaDocuments(db, {
        prealertaId: "pre-1",
        markbox: "DTD-1001",
      }),
    ).resolves.toEqual([
      {
        id: "doc-1",
        label: "Packing list",
        fileName: "packing.pdf",
        url: "https://storage.example.test/signed",
      },
    ]);
    expect(mocks.listPrealertaDocuments).toHaveBeenCalledWith(db, {
      prealertaId: "pre-1",
      markbox: "DTD-1001",
    });
    expect(from).toHaveBeenCalledWith("prealerta-docs");
    expect(createSignedUrl).toHaveBeenCalledWith(
      "tenant-a/pre-1/packing.pdf",
      120,
    );
  });

  it("no eleva la sesión cuando RLS no devuelve documentos", async () => {
    mocks.listPrealertaDocuments.mockResolvedValue([]);

    await expect(
      listSignedPrealertaDocuments(db, {
        prealertaId: "pre-1",
        markbox: "DTD-1001",
      }),
    ).resolves.toEqual([]);
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it("falla cerrado y conserva sólo metadatos si Storage no firma", async () => {
    mocks.listPrealertaDocuments.mockResolvedValue(docs);
    mocks.createAdminClient.mockImplementation(() => {
      throw new Error("sin storage");
    });

    await expect(
      listSignedPrealertaDocuments(db, {
        prealertaId: "pre-1",
        markbox: "DTD-1001",
      }),
    ).resolves.toEqual([
      {
        id: "doc-1",
        label: "Packing list",
        fileName: "packing.pdf",
        url: null,
      },
    ]);
  });

  it("rechaza argumentos vacíos antes de consultar", async () => {
    await expect(
      listSignedPrealertaDocuments(db, { prealertaId: "", markbox: "DTD-1001" }),
    ).resolves.toEqual([]);
    expect(mocks.listPrealertaDocuments).not.toHaveBeenCalled();
  });
});
